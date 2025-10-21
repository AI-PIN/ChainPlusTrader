/**
 * Retry utility with exponential backoff for handling rate limits and transient failures
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
  network?: string;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'network'>> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: ['429', 'rate limit', 'too many requests', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'],
};

// BASE network needs more aggressive retry strategy due to strict free RPC rate limits
const BASE_NETWORK_OPTIONS: Required<Omit<RetryOptions, 'network'>> = {
  maxRetries: 5,
  initialDelayMs: 2500,
  maxDelayMs: 20000,
  backoffMultiplier: 2.5,
  retryableErrors: ['429', 'rate limit', 'too many requests', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'],
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableError(error: any, retryableErrors: string[]): boolean {
  const errorString = String(error?.message || error).toLowerCase();
  return retryableErrors.some(retryableError => 
    errorString.includes(retryableError.toLowerCase())
  );
}

/**
 * Retry a function with exponential backoff
 * @param fn - Async function to retry
 * @param options - Retry configuration options
 * @returns Result of the function or throws the last error
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  // Use BASE-specific options if network is BASE
  const baseOptions = options.network === 'BASE' ? BASE_NETWORK_OPTIONS : DEFAULT_OPTIONS;
  const opts = { ...baseOptions, ...options };
  let lastError: any;
  let delayMs = opts.initialDelayMs;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // If this is the last attempt or error is not retryable, throw immediately
      if (attempt === opts.maxRetries || !isRetryableError(error, opts.retryableErrors!)) {
        throw error;
      }

      // Log retry attempt with network info if available
      const networkInfo = options.network ? ` [${options.network}]` : '';
      console.warn(
        `[RETRY]${networkInfo} Attempt ${attempt + 1}/${opts.maxRetries} failed. Retrying in ${delayMs}ms...`,
        error?.message || error
      );

      // Wait before retrying
      await sleep(delayMs);

      // Increase delay for next attempt (exponential backoff)
      delayMs = Math.min(delayMs * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError;
}
