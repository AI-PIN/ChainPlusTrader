import Web3 from 'web3';
import type { NetworkType } from '@shared/schema';
import { retryWithBackoff } from '../utils/retry';

// Uniswap V3 SwapRouter02 addresses
const ROUTER_ADDRESSES: Record<string, string> = {
  BASE: '0x2626664c2603336E57B271c5C0b26F421741e481', // SwapRouter02 on Base
};

// QuoterV2 addresses for getting quotes
const QUOTER_ADDRESSES: Record<string, string> = {
  BASE: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
};

// WETH addresses
const WETH_ADDRESSES: Record<string, string> = {
  BASE: '0x4200000000000000000000000000000000000006',
};

// SwapRouter02 ABI for exactInputSingle
const ROUTER_ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'tokenIn', type: 'address' },
          { internalType: 'address', name: 'tokenOut', type: 'address' },
          { internalType: 'uint24', name: 'fee', type: 'uint24' },
          { internalType: 'address', name: 'recipient', type: 'address' },
          { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
          { internalType: 'uint256', name: 'amountOutMinimum', type: 'uint256' },
          { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
        internalType: 'struct IV3SwapRouter.ExactInputSingleParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'exactInputSingle',
    outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;

// QuoterV2 ABI for quoteExactInputSingle
const QUOTER_ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'tokenIn', type: 'address' },
          { internalType: 'address', name: 'tokenOut', type: 'address' },
          { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
          { internalType: 'uint24', name: 'fee', type: 'uint24' },
          { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
        internalType: 'struct IQuoterV2.QuoteExactInputSingleParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'quoteExactInputSingle',
    outputs: [
      { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
      { internalType: 'uint160', name: 'sqrtPriceX96After', type: 'uint160' },
      { internalType: 'uint32', name: 'initializedTicksCrossed', type: 'uint32' },
      { internalType: 'uint256', name: 'gasEstimate', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
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
  {
    constant: false,
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function',
  },
] as const;

// Common fee tiers for Uniswap V3 (in basis points)
const FEE_TIERS = [100, 500, 3000, 10000]; // 0.01%, 0.05%, 0.3%, 1%

export interface UniswapV3SwapParams {
  web3: Web3;
  network: NetworkType;
  tokenAddress: string;
  amountETH: string;
  slippageTolerance: number;
  walletAddress: string;
  privateKey: string;
  nativeTokenPriceUsd: number;
}

export interface UniswapV3SwapResult {
  success: boolean;
  txHash?: string;
  tokenAmount?: string;
  gasFee?: string;
  gasFeeUsd?: string;
  tokenPrice?: string;
  slippage?: string;
  errorMessage?: string;
}

export class UniswapV3Client {
  async executeSwap(params: UniswapV3SwapParams): Promise<UniswapV3SwapResult> {
    try {
      const { web3, network, tokenAddress, amountETH, slippageTolerance, walletAddress, privateKey, nativeTokenPriceUsd } = params;

      // Get router, quoter, and WETH addresses for the network
      const routerAddress = ROUTER_ADDRESSES[network];
      const quoterAddress = QUOTER_ADDRESSES[network];
      const wethAddress = WETH_ADDRESSES[network];

      if (!routerAddress || !quoterAddress || !wethAddress) {
        return {
          success: false,
          errorMessage: `Uniswap V3 not configured for network ${network}`,
        };
      }

      // Verify token contract exists and get decimals
      const tokenContract = new web3.eth.Contract(ERC20_ABI, tokenAddress);
      let decimals;
      try {
        decimals = await retryWithBackoff(
          () => tokenContract.methods.decimals().call(),
          { network }
        );
      } catch (error: any) {
        console.error(`[UNISWAP V3] Token validation failed on ${network}:`, {
          tokenAddress,
          error: error.message,
          code: error.code,
        });
        return {
          success: false,
          errorMessage: `Invalid token address on ${network}. The token contract does not exist or is not a valid ERC20 token.`,
        };
      }

      // Convert ETH amount to Wei
      const amountInWei = web3.utils.toWei(amountETH, 'ether');

      // Create quoter contract instance
      const quoter = new web3.eth.Contract(QUOTER_ABI, quoterAddress);

      // Try different fee tiers to find a pool with liquidity
      let bestQuote: any = null;
      let bestFee = 0;
      
      for (const fee of FEE_TIERS) {
        try {
          const quoteParams = {
            tokenIn: wethAddress,
            tokenOut: tokenAddress,
            amountIn: amountInWei,
            fee: fee,
            sqrtPriceLimitX96: 0,
          };
          
          const quote = await retryWithBackoff(
            () => quoter.methods.quoteExactInputSingle(quoteParams).call(),
            { network }
          );
          
          if (quote.amountOut && quote.amountOut.toString() !== '0') {
            if (!bestQuote || BigInt(quote.amountOut.toString()) > BigInt(bestQuote.amountOut.toString())) {
              bestQuote = quote;
              bestFee = fee;
            }
          }
        } catch (error: any) {
          // Pool doesn't exist for this fee tier or rate limited, try next
          continue;
        }
        
        // Small delay between fee tier checks to avoid overwhelming rate limits (especially on BASE)
        if (network === 'BASE') {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (!bestQuote) {
        console.error(`[UNISWAP V3] No liquidity pool found on ${network}:`, {
          tokenAddress,
          wethAddress,
          triedFees: FEE_TIERS.map(f => `${f/10000}%`),
        });
        return {
          success: false,
          errorMessage: `No Uniswap V3 liquidity pool found for this token on ${network}. Tried fee tiers: 0.01%, 0.05%, 0.3%, 1%.`,
        };
      }

      const expectedTokenAmount = bestQuote.amountOut;

      // Validate we got a valid quote
      if (!expectedTokenAmount || expectedTokenAmount.toString() === '0') {
        return {
          success: false,
          errorMessage: `Unable to get swap quote. The token may have insufficient liquidity on Uniswap V3 on ${network}.`,
        };
      }

      // Calculate minimum amount with slippage
      const slippageMultiplier = 1 - slippageTolerance / 100;
      const minAmountOut = (BigInt(expectedTokenAmount.toString()) * BigInt(Math.floor(slippageMultiplier * 1000))) / BigInt(1000);

      // Create router contract instance
      const router = new web3.eth.Contract(ROUTER_ABI, routerAddress);

      // Build swap parameters
      const swapParams = {
        tokenIn: wethAddress,
        tokenOut: tokenAddress,
        fee: bestFee,
        recipient: walletAddress,
        amountIn: amountInWei,
        amountOutMinimum: minAmountOut.toString(),
        sqrtPriceLimitX96: 0,
      };

      // Build swap transaction
      const swapData = router.methods.exactInputSingle(swapParams).encodeABI();

      // Estimate gas with retry logic
      const gasEstimate = await retryWithBackoff(
        () => web3.eth.estimateGas({
          from: walletAddress,
          to: routerAddress,
          value: amountInWei,
          data: swapData,
        }),
        { network }
      );

      const gasPrice = await retryWithBackoff(
        () => web3.eth.getGasPrice(),
        { network }
      );
      const gasFeeWei = BigInt(gasEstimate) * BigInt(gasPrice);
      const gasFeeETH = web3.utils.fromWei(gasFeeWei.toString(), 'ether');

      // Build and sign transaction
      const swapTx = {
        from: walletAddress,
        to: routerAddress,
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
        { network }
      );

      // Calculate gas fee in USD using current market price
      const gasFeeUsd = (parseFloat(gasFeeETH) * nativeTokenPriceUsd).toFixed(2);

      // Convert token balance to human-readable format
      const tokenDecimals = Number(decimals);
      const tokenAmount = (Number(expectedTokenAmount) / Math.pow(10, tokenDecimals)).toFixed(6);

      // Calculate token price
      const tokenPrice = (parseFloat(amountETH) / parseFloat(tokenAmount)).toFixed(6);

      const txHash = typeof receipt.transactionHash === 'string'
        ? receipt.transactionHash
        : web3.utils.bytesToHex(receipt.transactionHash);

      console.log(`[UNISWAP V3] Swap successful on ${network}:`, {
        txHash,
        tokenAmount,
        feeTier: `${bestFee / 10000}%`,
        tokenAddress,
      });

      return {
        success: true,
        txHash,
        tokenAmount,
        gasFee: gasFeeETH,
        gasFeeUsd,
        tokenPrice,
        slippage: slippageTolerance.toFixed(2),
      };
    } catch (error: any) {
      console.error('[UNISWAP V3] Swap error:', error);
      return {
        success: false,
        errorMessage: `Uniswap V3 swap failed: ${error.message}`,
      };
    }
  }
}

export const uniswapV3Client = new UniswapV3Client();
