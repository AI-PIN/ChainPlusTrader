import Web3 from 'web3';
import type { NetworkType } from '@shared/schema';
import { retryWithBackoff } from '../utils/retry';

// Uniswap V2 Router addresses
const ROUTER_ADDRESSES: Record<string, string> = {
  ETH: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2 Router
  BASE: '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24', // BaseSwap Router (Uniswap V2 fork on Base)
};

// WETH addresses
const WETH_ADDRESSES: Record<string, string> = {
  ETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  BASE: '0x4200000000000000000000000000000000000006',
};

// Minimal Uniswap V2 Router ABI
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

export interface UniswapSwapParams {
  web3: Web3;
  network: NetworkType;
  tokenAddress: string;
  amountETH: string;
  slippageTolerance: number;
  walletAddress: string;
  privateKey: string;
  nativeTokenPriceUsd: number;
}

export interface UniswapSwapResult {
  success: boolean;
  txHash?: string;
  tokenAmount?: string;
  gasFee?: string;
  gasFeeUsd?: string;
  tokenPrice?: string;
  slippage?: string;
  errorMessage?: string;
}

export class UniswapClient {
  async executeSwap(params: UniswapSwapParams): Promise<UniswapSwapResult> {
    try {
      const { web3, network, tokenAddress, amountETH, slippageTolerance, walletAddress, privateKey, nativeTokenPriceUsd } = params;

      // Get router and WETH addresses for the network
      const routerAddress = ROUTER_ADDRESSES[network];
      const wethAddress = WETH_ADDRESSES[network];

      if (!routerAddress || !wethAddress) {
        return {
          success: false,
          errorMessage: `Uniswap not configured for network ${network}`,
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
        console.error(`[UNISWAP] Token validation failed on ${network}:`, {
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

      // Create router contract instance
      const router = new web3.eth.Contract(ROUTER_ABI, routerAddress);

      // Get quote for the swap
      const path = [wethAddress, tokenAddress];
      let amounts;
      try {
        amounts = await retryWithBackoff(
          () => router.methods.getAmountsOut(amountInWei, path).call(),
          { network }
        );
      } catch (error: any) {
        // This typically means the liquidity pool doesn't exist for this token pair
        console.error(`[UNISWAP] Liquidity pool check failed on ${network}:`, {
          tokenAddress,
          path,
          error: error.message,
          code: error.code,
        });
        return {
          success: false,
          errorMessage: `No liquidity pool found for this token on ${network}. The token may not be traded on Uniswap V2, or the token address is invalid.`,
        };
      }

      const expectedTokenAmount = amounts[1];

      // Validate we got a valid quote
      if (!expectedTokenAmount || expectedTokenAmount.toString() === '0') {
        return {
          success: false,
          errorMessage: `Unable to get swap quote. The token may have insufficient liquidity on Uniswap V2 on ${network}.`,
        };
      }

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
      console.error('Uniswap swap error:', error);
      return {
        success: false,
        errorMessage: `Uniswap swap failed: ${error.message}`,
      };
    }
  }
}

export const uniswapClient = new UniswapClient();
