import Web3 from 'web3';
import { Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import type { NetworkType, DexType } from '@shared/schema';
import { uniswapClient } from './dex/uniswapClient';
import { uniswapV3Client } from './dex/uniswapV3Client';
import { pancakeswapClient } from './dex/pancakeswapClient';
import { jupiterClient } from './dex/jupiterClient';
import { priceService } from './priceService';

export interface TradeResult {
  success: boolean;
  txHash?: string;
  tokenAmount?: string;
  gasFee?: string;
  gasFeeUsd?: string;
  tokenPrice?: string;
  slippage?: string;
  errorMessage?: string;
}

export interface TradeParams {
  network: NetworkType;
  dex: DexType;
  dexVersion?: string; // 'v2' or 'v3' for BASE Uniswap
  tokenAddress: string;
  amountUsd: number;
  slippageTolerance: number;
  maxGasRatio: number;
}

export class TradingService {
  private web3Instances: Map<string, Web3> = new Map();
  private solanaConnection: Connection | null = null;

  constructor() {
    // Initialize Web3 instances for EVM chains
    if (process.env.RPC_URL_ETH) {
      this.web3Instances.set('ETH', new Web3(process.env.RPC_URL_ETH));
    }
    if (process.env.RPC_URL_BASE) {
      this.web3Instances.set('BASE', new Web3(process.env.RPC_URL_BASE));
    }
    if (process.env.RPC_URL_BNB) {
      this.web3Instances.set('BNB', new Web3(process.env.RPC_URL_BNB));
    }

    // Initialize Solana connection
    if (process.env.RPC_URL_SOL) {
      this.solanaConnection = new Connection(process.env.RPC_URL_SOL);
    }
  }

  async executeTrade(params: TradeParams): Promise<TradeResult> {
    try {
      // Validate network availability
      if (!this.isNetworkAvailable(params.network)) {
        return {
          success: false,
          errorMessage: `Network ${params.network} not configured. Please add RPC_URL_${params.network} and PRIVATE_KEY_${params.network} to environment.`,
        };
      }

      // Validate token address format
      if (!this.isValidTokenAddress(params.network, params.tokenAddress)) {
        return {
          success: false,
          errorMessage: `Invalid token address format for ${params.network} network`,
        };
      }

      // Log trade execution attempt
      console.log(`[TRADING] Executing ${params.network} trade:`, {
        dex: params.dex,
        tokenAddress: params.tokenAddress,
        amountUsd: params.amountUsd,
        slippage: params.slippageTolerance,
        maxGasRatio: params.maxGasRatio,
      });

      // Execute trade based on network
      let result: TradeResult;
      if (params.network === 'SOL') {
        result = await this.executeSolanaTrade(params);
      } else {
        result = await this.executeEVMTrade(params);
      }

      // Log trade result
      if (result.success) {
        console.log(`[TRADING] Trade successful:`, {
          txHash: result.txHash,
          tokenAmount: result.tokenAmount,
          gasFee: result.gasFee,
        });
      } else {
        console.error(`[TRADING] Trade failed:`, result.errorMessage);
      }

      return result;
    } catch (error: any) {
      console.error('[TRADING] Trade execution error:', error);
      return {
        success: false,
        errorMessage: error.message || 'Unknown error occurred during trade execution',
      };
    }
  }

  private isValidTokenAddress(network: NetworkType, address: string): boolean {
    if (network === 'SOL') {
      // Solana addresses are base58 encoded, 32-44 characters
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    } else {
      // EVM addresses are hex strings starting with 0x, 42 characters total
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
  }

  private async executeEVMTrade(params: TradeParams): Promise<TradeResult> {
    const web3 = this.web3Instances.get(params.network);
    if (!web3) {
      return {
        success: false,
        errorMessage: `Web3 instance not found for ${params.network}`,
      };
    }

    try {
      // Get private key and wallet address
      const privateKey = this.getPrivateKey(params.network);
      if (!privateKey) {
        return {
          success: false,
          errorMessage: `Private key not configured for ${params.network}`,
        };
      }

      const account = web3.eth.accounts.privateKeyToAccount(privateKey);
      const walletAddress = account.address;

      // Get current native token price from API
      const nativeTokenPriceUsd = await priceService.getPrice(params.network);
      const amountNative = params.amountUsd / nativeTokenPriceUsd;

      // Pre-check gas ratio before executing trade
      const gasEstimate = await this.estimateGas(params.network, params.amountUsd);
      if (gasEstimate.gasRatio > params.maxGasRatio) {
        return {
          success: false,
          errorMessage: `Gas fee ($${gasEstimate.gasFeeUsd.toFixed(2)}) exceeds ${(params.maxGasRatio * 100).toFixed(0)}% of trade value ($${params.amountUsd})`,
          gasFee: (gasEstimate.gasFeeUsd / nativeTokenPriceUsd).toFixed(6),
          gasFeeUsd: gasEstimate.gasFeeUsd.toFixed(2),
        };
      }

      // Execute trade based on network and DEX
      if (params.network === 'BNB') {
        // Use PancakeSwap for BNB Chain
        return await pancakeswapClient.executeSwap({
          web3,
          tokenAddress: params.tokenAddress,
          amountBNB: amountNative.toString(),
          slippageTolerance: params.slippageTolerance,
          walletAddress,
          privateKey,
          bnbPriceUsd: nativeTokenPriceUsd,
        });
      } else if (params.network === 'BASE' || params.network === 'ETH') {
        // Handle V4 selection (not implemented yet)
        if (params.dexVersion === 'v4') {
          return {
            success: false,
            errorMessage: 'Uniswap V4 integration is under development. Please select V2, V3, or auto-detect mode.',
          };
        }

        // Handle V2 only
        if (params.dexVersion === 'v2') {
          console.log(`[TRADING] Using Uniswap V2 for ${params.network} (user selected)`);
          return await uniswapClient.executeSwap({
            web3,
            network: params.network,
            tokenAddress: params.tokenAddress,
            amountETH: amountNative.toString(),
            slippageTolerance: params.slippageTolerance,
            walletAddress,
            privateKey,
            nativeTokenPriceUsd: nativeTokenPriceUsd,
          });
        }

        // Try V3 (either user selected v3 or auto mode)
        const isAutoMode = !params.dexVersion || params.dexVersion === 'auto';
        console.log(`[TRADING] Using Uniswap V3 for ${params.network}${params.dexVersion === 'v3' ? ' (user selected)' : ' (auto-detect)'}`);
        const v3Result = await uniswapV3Client.executeSwap({
          web3,
          network: params.network,
          tokenAddress: params.tokenAddress,
          amountETH: amountNative.toString(),
          slippageTolerance: params.slippageTolerance,
          walletAddress,
          privateKey,
          nativeTokenPriceUsd: nativeTokenPriceUsd,
        });

        // If V3 succeeds or user explicitly chose V3, return the result
        if (v3Result.success || params.dexVersion === 'v3') {
          return v3Result;
        }

        // Auto-fallback to V2 only in auto mode when V3 pool not found
        if (isAutoMode && v3Result.errorMessage?.includes('No Uniswap V3 liquidity pool found')) {
          console.log(`[TRADING] V3 pool not found for ${params.network}, trying V2 fallback...`);
          return await uniswapClient.executeSwap({
            web3,
            network: params.network,
            tokenAddress: params.tokenAddress,
            amountETH: amountNative.toString(),
            slippageTolerance: params.slippageTolerance,
            walletAddress,
            privateKey,
            nativeTokenPriceUsd: nativeTokenPriceUsd,
          });
        }

        // Return V3 error if fallback didn't apply
        return v3Result;
      } else {
        // Use PancakeSwap for BNB Chain
        return await pancakeswapClient.executeSwap({
          web3,
          tokenAddress: params.tokenAddress,
          amountBNB: amountNative.toString(),
          slippageTolerance: params.slippageTolerance,
          walletAddress,
          privateKey,
          bnbPriceUsd: nativeTokenPriceUsd,
        });
      }
    } catch (error: any) {
      return {
        success: false,
        errorMessage: `EVM trade failed: ${error.message}`,
      };
    }
  }

  private async executeSolanaTrade(params: TradeParams): Promise<TradeResult> {
    if (!this.solanaConnection) {
      return {
        success: false,
        errorMessage: 'Solana connection not configured',
      };
    }

    try {
      // Get private key and wallet address
      const privateKey = this.getPrivateKey('SOL');
      if (!privateKey) {
        return {
          success: false,
          errorMessage: 'Solana private key not configured',
        };
      }

      // Decode private key to get wallet address
      const secretKeyBytes = bs58.decode(privateKey);
      const keypair = Keypair.fromSecretKey(secretKeyBytes);
      const walletAddress = keypair.publicKey.toString();

      // Get current SOL price from API
      const solPriceUsd = await priceService.getPrice('SOL');
      const amountSOL = params.amountUsd / solPriceUsd;

      // Execute Jupiter swap
      return await jupiterClient.executeSwap({
        connection: this.solanaConnection,
        tokenMint: params.tokenAddress,
        amountSOL,
        slippageBps: Math.floor(params.slippageTolerance * 100), // Convert to basis points
        walletAddress,
        privateKey,
        solPriceUsd,
      });
    } catch (error: any) {
      return {
        success: false,
        errorMessage: `Solana trade failed: ${error.message}`,
      };
    }
  }

  private isNetworkAvailable(network: NetworkType): boolean {
    const privateKey = this.getPrivateKey(network);
    
    if (network === 'SOL') {
      return !!privateKey && !!this.solanaConnection;
    } else {
      return !!privateKey && this.web3Instances.has(network);
    }
  }

  private getPrivateKey(network: NetworkType): string | undefined {
    const envKey = `PRIVATE_KEY_${network}`;
    return process.env[envKey];
  }

  async estimateGas(network: NetworkType, amountUsd: number): Promise<{ gasFeeUsd: number; gasRatio: number }> {
    if (network === 'SOL') {
      // Solana has very low fees
      return { gasFeeUsd: 0.01, gasRatio: 0.01 / amountUsd };
    }

    const web3 = this.web3Instances.get(network);
    if (!web3) {
      return { gasFeeUsd: 0, gasRatio: 0 };
    }

    try {
      const gasPrice = await web3.eth.getGasPrice();
      const estimatedGas = BigInt(200000); // Typical swap gas for DEX trades
      const gasFeeWei = BigInt(gasPrice) * estimatedGas;
      const gasFeeNative = web3.utils.fromWei(gasFeeWei.toString(), 'ether');
      
      const nativeTokenPrice = await priceService.getPrice(network);
      const gasFeeUsd = parseFloat(gasFeeNative) * nativeTokenPrice;
      const gasRatio = gasFeeUsd / amountUsd;

      return { gasFeeUsd, gasRatio };
    } catch (error) {
      return { gasFeeUsd: 0, gasRatio: 0 };
    }
  }
}

export const tradingService = new TradingService();
