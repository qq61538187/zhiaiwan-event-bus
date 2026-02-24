import { describe, expect, it, vi } from 'vitest'
import { createEventBus } from '../src'

type Events = {
  'job.run': [id: string]
}

describe('policies', () => {
  it('retries failing handlers based on retry policy', async () => {
    const bus = createEventBus<Events>()
    const flaky = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce('ok')

    bus.on('job.run', () => flaky(), {
      retry: { times: 1, delayMs: 0, backoff: 'fixed' },
    })

    const result = await bus.emitCollect('job.run', ['a'])
    expect(result).toEqual(['ok'])
    expect(flaky).toHaveBeenCalledTimes(2)
  })

  it('supports linear and exponential retry backoff', async () => {
    const linearBus = createEventBus<Events>()
    const linearFlaky = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('linear-ok')
    linearBus.on('job.run', () => linearFlaky(), {
      retry: { times: 1, delayMs: 0, backoff: 'linear' },
    })
    await expect(linearBus.emitCollect('job.run', ['a'])).resolves.toEqual(['linear-ok'])
    expect(linearFlaky).toHaveBeenCalledTimes(2)

    const expBus = createEventBus<Events>()
    const expFlaky = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('exp-ok')
    expBus.on('job.run', () => expFlaky(), {
      retry: { times: 1, delayMs: 0, backoff: 'exponential' },
    })
    await expect(expBus.emitCollect('job.run', ['a'])).resolves.toEqual(['exp-ok'])
    expect(expFlaky).toHaveBeenCalledTimes(2)
  })

  it('times out slow handlers', async () => {
    const bus = createEventBus<Events>()
    bus.on(
      'job.run',
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 20))
        return 'late'
      },
      { timeoutMs: 1 },
    )

    await expect(bus.emitCollect('job.run', ['a'])).rejects.toThrow(/timeout/)
  })

  it('cancels running emit with AbortSignal', async () => {
    const bus = createEventBus<Events>()
    bus.on(
      'job.run',
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
        return 'done'
      },
      { timeoutMs: 50 },
    )

    const controller = new AbortController()
    controller.abort()
    await expect(
      bus.emitCollect('job.run', ['a'], {
        signal: controller.signal,
      }),
    ).rejects.toThrow(/aborted/)
  })

  it('limits concurrent executions per listener', async () => {
    const bus = createEventBus<Events>()
    let active = 0
    let peak = 0
    bus.on(
      'job.run',
      async () => {
        active += 1
        peak = Math.max(peak, active)
        await new Promise((resolve) => setTimeout(resolve, 10))
        active -= 1
      },
      { concurrency: 1 },
    )

    await Promise.all([
      bus.emit('job.run', ['1']),
      bus.emit('job.run', ['2']),
      bus.emit('job.run', ['3']),
    ])
    expect(peak).toBe(1)
  })

  it('expires replay entries with ttl', async () => {
    const bus = createEventBus<Events>({ replay: { count: 5, ttlMs: 1 } })
    await bus.emit('job.run', ['1'])
    await new Promise((resolve) => setTimeout(resolve, 3))
    await bus.emit('job.run', ['2'])
    expect(bus.replayFor('job.run')).toEqual([['2']])
  })
})
