import { Connection, PublicKey, Transaction, VersionedTransaction, Keypair } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import { createJupiterApiClient, QuoteGetRequest, QuoteResponse } from '@jup-ag/api';
import bs58 from 'bs58';
import { retryWithBackoff } from '../utils/retry';

export interface JupiterSwapParams {
  connection: Connection;
  tokenMint: string; // Token to buy
  amountSOL: number; // Amount in SOL
  slippageBps: number; // Slippage in basis points (e.g., 50 = 0.5%)
  walletAddress: string;
  privateKey: string; // Base58 encoded private key
  solPriceUsd: number;
}

export interface JupiterSwapResult {
  success: boolean;
  txHash?: string;
  tokenAmount?: string;
  gasFee?: string;
  gasFeeUsd?: string;
  tokenPrice?: string;
  slippage?: string;
  errorMessage?: string;
}

const NATIVE_SOL_MINT = 'So11111111111111111111111111111111111111112'; // Wrapped SOL mint
const LAMPORTS_PER_SOL = 1_000_000_000;

export class JupiterClient {
  private jupiterApi = createJupiterApiClient();

  async executeSwap(params: JupiterSwapParams): Promise<JupiterSwapResult> {
    try {
      const { connection, tokenMint, amountSOL, slippageBps, walletAddress, privateKey, solPriceUsd } = params;

      // Convert SOL to lamports
      const amountInLamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);

      // Get quote from Jupiter with retry logic
      const quoteRequest: QuoteGetRequest = {
        inputMint: NATIVE_SOL_MINT,
        outputMint: tokenMint,
        amount: amountInLamports,
        slippageBps,
      };

      const quote = await retryWithBackoff(
        () => this.jupiterApi.quoteGet(quoteRequest),
        { maxRetries: 3, initialDelayMs: 2000 }
      );

      if (!quote) {
        return {
          success: false,
          errorMessage: 'Failed to get quote from Jupiter',
        };
      }

      // Get swap transaction with retry logic
      const swapResponse = await retryWithBackoff(
        () => this.jupiterApi.swapPost({
          swapRequest: {
            quoteResponse: quote,
            userPublicKey: walletAddress,
            wrapAndUnwrapSol: true,
            dynamicComputeUnitLimit: true,
          },
        }),
        { maxRetries: 3, initialDelayMs: 2000 }
      );

      // Decode the transaction
      const swapTransactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
      let transaction: VersionedTransaction | Transaction;

      try {
        transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      } catch {
        transaction = Transaction.from(swapTransactionBuf);
      }

      // Sign the transaction
      // Decode base58 private key
      const secretKeyBytes = bs58.decode(privateKey);
      const keypair = Keypair.fromSecretKey(secretKeyBytes);

      if (transaction instanceof VersionedTransaction) {
        transaction.sign([keypair]);
      } else {
        transaction.sign(keypair);
      }

      // Send transaction with retry logic
      const rawTransaction = transaction.serialize();
      const txid = await retryWithBackoff(
        () => connection.sendRawTransaction(rawTransaction, {
          skipPreflight: false,
          maxRetries: 2,
        }),
        { maxRetries: 2, initialDelayMs: 1500 }
      );

      // Confirm transaction with retry logic
      const latestBlockhash = await retryWithBackoff(
        () => connection.getLatestBlockhash(),
        { maxRetries: 2, initialDelayMs: 1000 }
      );
      await retryWithBackoff(
        () => connection.confirmTransaction({
          signature: txid,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        }),
        { maxRetries: 2, initialDelayMs: 1000 }
      );

      // Get token decimals from on-chain mint data
      const outputAmount = quote.outAmount;
      let tokenDecimals = 9; // Default for most SPL tokens
      
      try {
        const mintPublicKey = new PublicKey(tokenMint);
        const mintInfo = await getMint(connection, mintPublicKey);
        tokenDecimals = mintInfo.decimals;
      } catch (error) {
        console.warn(`Could not fetch token decimals for ${tokenMint}, using default 9:`, error);
      }

      const tokenAmount = (Number(outputAmount) / Math.pow(10, tokenDecimals)).toFixed(6);

      // Calculate token price
      const tokenPrice = (amountSOL / parseFloat(tokenAmount)).toFixed(6);

      // Estimate gas fee (Solana fees are very low)
      const gasFee = '0.000005'; // ~5000 lamports typical
      const gasFeeUsd = (parseFloat(gasFee) * solPriceUsd).toFixed(4);

      return {
        success: true,
        txHash: txid,
        tokenAmount,
        gasFee,
        gasFeeUsd,
        tokenPrice,
        slippage: (slippageBps / 100).toFixed(2),
      };
    } catch (error: any) {
      console.error('Jupiter swap error:', error);
      return {
        success: false,
        errorMessage: `Jupiter swap failed: ${error.message}`,
      };
    }
  }
}

export const jupiterClient = new JupiterClient();
