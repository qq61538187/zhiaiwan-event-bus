import type { RetryConfig } from './types'

const RETRIABLE_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENOTFOUND',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
])

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function retryDelay(config: RetryConfig, attempt: number): number {
  const base = config.delayMs ?? 0
  if (config.backoff === 'linear') return base * attempt
  if (config.backoff === 'exponential') return base * 2 ** (attempt - 1)
  return base
}

const RETRY_PROFILES: Record<
  NonNullable<RetryConfig['profile']>,
  Required<Pick<RetryConfig, 'times' | 'delayMs' | 'backoff' | 'jitterMs'>>
> = {
  aggressive: { times: 5, delayMs: 50, backoff: 'exponential', jitterMs: 30 },
  balanced: { times: 3, delayMs: 100, backoff: 'linear', jitterMs: 20 },
  conservative: { times: 2, delayMs: 200, backoff: 'fixed', jitterMs: 0 },
}

function jitterDelay(baseDelay: number, config: RetryConfig): number {
  const jitterMs = config.jitterMs ?? 0
  if (jitterMs <= 0) return baseDelay
  return baseDelay + Math.random() * jitterMs
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined
}

function normalizeRetryConfig(retry: number | RetryConfig | undefined): RetryConfig | undefined {
  if (retry === undefined) return undefined
  if (typeof retry === 'number') return { times: Math.max(0, Math.floor(retry)) }

  const profileDefaults = retry.profile ? RETRY_PROFILES[retry.profile] : undefined
  const merged: RetryConfig = {
    ...profileDefaults,
    ...retry,
  }
  const times = merged.times ?? 0
  merged.times = Math.max(0, Math.floor(times))
  return merged
}

export function isRetriableNetworkError(error: unknown): boolean {
  const record = asRecord(error)
  const code = typeof record?.code === 'string' ? record.code : undefined
  if (code && RETRIABLE_ERROR_CODES.has(code)) return true

  const status =
    typeof record?.status === 'number'
      ? record.status
      : typeof asRecord(record?.response)?.status === 'number'
        ? (asRecord(record?.response)?.status as number)
        : undefined
  if (status !== undefined && (status >= 500 || status === 408 || status === 429)) return true

  const message =
    error instanceof Error
      ? error.message
      : typeof record?.message === 'string'
        ? record.message
        : ''
  if (/(timeout|network|socket|temporarily unavailable)/i.test(message)) return true

  const cause = record?.cause
  if (cause && cause !== error) {
    return isRetriableNetworkError(cause)
  }
  return false
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
  const config = normalizeRetryConfig(retry)
  const times = config?.times ?? 0
  let attempt = 0
  while (attempt <= times) {
    try {
      attempt += 1
      return await runner(attempt)
    } catch (error) {
      if (attempt > times) throw error
      if (config?.shouldRetry) {
        const shouldRetry = await config.shouldRetry(error, attempt)
        if (!shouldRetry) throw error
      }
      const baseDelay = config ? retryDelay(config, attempt) : 0
      const delay = config ? jitterDelay(baseDelay, config) : 0
      await sleep(delay)
    }
  }
  throw new Error('unreachable')
}
