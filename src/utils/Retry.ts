/**
 * Retry utility with exponential backoff
 */
export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  timeout?: number;
}

/**
 * Executes an async function with retry logic.
 * Uses exponential backoff: delay = baseDelay * 2^attempt.
 * Throws if all retries are exhausted or timeout is reached.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, timeout = 30000 } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Create a promise that rejects on timeout
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Operation timed out')), timeout)
        ),
      ]);
      return result;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}