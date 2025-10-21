import Web3 from 'web3';
import type { NetworkType } from '@shared/schema';
import { retryWithBackoff } from '../utils/retry';

// PancakeSwap V2 Router address on BNB Chain
const PANCAKE_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

// Minimal PancakeSwap Router ABI
const ROUTER_ABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
      { internalType: 'address[]', name: 'path', type: 'address[]' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactETHForTokens',
    outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'address[]', name: 'path', type: 'address[]' },
    ],
    name: 'getAmountsOut',
    outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const ERC20_ABI = [
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
] as const;

export interface PancakeSwapParams {
  web3: Web3;
  tokenAddress: string;
  amountBNB: string;
  slippageTolerance: number;
  walletAddress: string;
  privateKey: string;
  bnbPriceUsd: number;
}

export interface PancakeSwapResult {
  success: boolean;
  txHash?: string;
  tokenAmount?: string;
  gasFee?: string;
  gasFeeUsd?: string;
  tokenPrice?: string;
  slippage?: string;
  errorMessage?: string;
}

export class PancakeSwapClient {
  async executeSwap(params: PancakeSwapParams): Promise<PancakeSwapResult> {
    try {
      const { web3, tokenAddress, amountBNB, slippageTolerance, walletAddress, privateKey, bnbPriceUsd } = params;

      // Get token decimals with retry logic
      const tokenContract = new web3.eth.Contract(ERC20_ABI, tokenAddress);
      const decimals = await retryWithBackoff(
        () => tokenContract.methods.decimals().call(),
        { network: 'BNB' }
      );

      // Convert BNB amount to Wei
      const amountInWei = web3.utils.toWei(amountBNB, 'ether');

      // Create router contract instance
      const router = new web3.eth.Contract(ROUTER_ABI, PANCAKE_ROUTER);

      // Get quote for the swap with retry logic
      const path = [WBNB, tokenAddress];
      const amounts = await retryWithBackoff(
        () => router.methods.getAmountsOut(amountInWei, path).call(),
        { network: 'BNB' }
      );
      const expectedTokenAmount = amounts[1];

      // Calculate minimum amount with slippage
      const slippageMultiplier = 1 - slippageTolerance / 100;
      const minAmountOut = (BigInt(expectedTokenAmount.toString()) * BigInt(Math.floor(slippageMultiplier * 1000))) / BigInt(1000);

      // Set deadline (20 minutes from now)
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

      // Build swap transaction
      const swapData = router.methods
        .swapExactETHForTokens(minAmountOut.toString(), path, walletAddress, deadline)
        .encodeABI();

      // Estimate gas with retry logic
      const gasEstimate = await retryWithBackoff(
        () => web3.eth.estimateGas({
          from: walletAddress,
          to: PANCAKE_ROUTER,
          value: amountInWei,
          data: swapData,
        }),
        { network: 'BNB' }
      );

      const gasPrice = await retryWithBackoff(
        () => web3.eth.getGasPrice(),
        { network: 'BNB' }
      );
      const gasFeeWei = BigInt(gasEstimate) * BigInt(gasPrice);
      const gasFeeBNB = web3.utils.fromWei(gasFeeWei.toString(), 'ether');

      // Build and sign transaction
      const swapTx = {
        from: walletAddress,
        to: PANCAKE_ROUTER,
        value: amountInWei,
        data: swapData,
        gas: gasEstimate.toString(),
        gasPrice: gasPrice.toString(),
      };

      const signedTx = await web3.eth.accounts.signTransaction(swapTx, privateKey);
      const rawTx = typeof signedTx.rawTransaction === 'string' 
        ? signedTx.rawTransaction 
        : web3.utils.bytesToHex(signedTx.rawTransaction!);
      
      const receipt = await retryWithBackoff(
        () => web3.eth.sendSignedTransaction(rawTx),
        { network: 'BNB' }
      );

      // Calculate gas fee in USD using current market price
      const gasFeeUsd = (parseFloat(gasFeeBNB) * bnbPriceUsd).toFixed(2);

      // Convert token balance to human-readable format
      const tokenDecimals = Number(decimals);
      const tokenAmount = (Number(expectedTokenAmount) / Math.pow(10, tokenDecimals)).toFixed(6);
      const tokenPrice = (parseFloat(amountBNB) / parseFloat(tokenAmount)).toFixed(6);

      const txHash = typeof receipt.transactionHash === 'string' 
        ? receipt.transactionHash 
        : web3.utils.bytesToHex(receipt.transactionHash);

      return {
        success: true,
        txHash,
        tokenAmount,
        gasFee: gasFeeBNB,
        gasFeeUsd,
        tokenPrice,
        slippage: slippageTolerance.toFixed(2),
      };
    } catch (error: any) {
      console.error('PancakeSwap swap error:', error);
      return {
        success: false,
        errorMessage: `PancakeSwap swap failed: ${error.message}`,
      };
    }
  }
}

export const pancakeswapClient = new PancakeSwapClient();
