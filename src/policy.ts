import type { RetryConfig } from './types'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function retryDelay(config: RetryConfig, attempt: number): number {
  const base = config.delayMs ?? 0
  if (config.backoff === 'linear') return base * attempt
  if (config.backoff === 'exponential') return base * 2 ** (attempt - 1)
  return base
}

export async function withTimeout<T>(
  task: Promise<T>,
  timeoutMs?: number,
  signal?: AbortSignal,
): Promise<T> {
  if (timeoutMs === undefined && !signal) return task
  if (signal?.aborted) throw new Error('emit aborted')

  return await new Promise<T>((resolve, reject) => {
    const timeoutId =
      timeoutMs !== undefined
        ? setTimeout(() => reject(new Error(`handler timeout after ${timeoutMs}ms`)), timeoutMs)
        : undefined

    const abortListener = () => reject(new Error('emit aborted'))
    if (signal) signal.addEventListener('abort', abortListener, { once: true })

    task.then(resolve, reject).finally(() => {
      if (timeoutId) clearTimeout(timeoutId)
      if (signal) signal.removeEventListener('abort', abortListener)
    })
  })
}

export async function withRetry<T>(
  runner: (attempt: number) => Promise<T>,
  retry?: number | RetryConfig,
): Promise<T> {
  const config: RetryConfig | undefined =
    retry === undefined ? undefined : typeof retry === 'number' ? { times: retry } : retry
  const times = config?.times ?? 0
  let attempt = 0
  while (attempt <= times) {
    try {
      attempt += 1
      return await runner(attempt)
    } catch (error) {
      if (attempt > times) throw error
      await sleep(config ? retryDelay(config, attempt) : 0)
    }
  }
  throw new Error('unreachable')
}
