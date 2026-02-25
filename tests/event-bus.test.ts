import { describe, expect, it, vi } from 'vitest'
import type { EventAdapter } from '../src'
import { createEventBus, InMemoryAdapter, isPatternMatch } from '../src'

type AppEvents = {
  'user.login': [id: string]
  'user.logout': [id: string]
  'order.created': [orderId: string, amount: number]
}

describe('EventBus', () => {
  it('supports exact and wildcard pattern matching', () => {
    expect(isPatternMatch('user.login', 'user.login')).toBe(true)
    expect(isPatternMatch('user.*', 'user.login')).toBe(true)
    expect(isPatternMatch('user.**', 'user.session.refresh')).toBe(true)
    expect(isPatternMatch('order.*', 'user.login')).toBe(false)
  })

  it('emits and returns boolean hit result', async () => {
    const bus = createEventBus<AppEvents>()
    await expect(bus.emit('user.login', ['u1'])).resolves.toBe(false)
    bus.on('user.login', vi.fn())
    await expect(bus.emit('user.login', ['u1'])).resolves.toBe(true)
    expect(bus.eventNames()).toContain('user.login')
  })

  it('supports onPattern subscriptions', async () => {
    const bus = createEventBus<AppEvents>()
    const wildcard = vi.fn()
    bus.onPattern('user.*', wildcard)
    await bus.emit('user.login', ['u1'])
    expect(wildcard).toHaveBeenCalledTimes(1)
    expect(wildcard.mock.calls[0][0]).toEqual(['user.login', 'u1'])
  })

  it('supports middleware short-circuit', async () => {
    const onLogin = vi.fn()
    const bus = createEventBus<AppEvents>({
      middleware: [
        async (ctx, next) => {
          if (ctx.event === 'user.login') return
          await next()
        },
      ],
    })
    bus.on('user.login', onLogin)
    await bus.emit('user.login', ['u1'])
    expect(onLogin).not.toHaveBeenCalled()
  })

  it('supports collect strategies', async () => {
    const bus = createEventBus<AppEvents>()
    bus.on('user.login', async ([id]) => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      return id.toUpperCase()
    })
    bus.on('user.login', async ([id]) => {
      await new Promise((resolve) => setTimeout(resolve, 1))
      return `${id}-ok`
    })
    const arr = await bus.emitCollect('user.login', ['u1'])
    expect(arr).toEqual(['U1', 'u1-ok'])
    const first = await bus.emitCollect('user.login', ['u2'], { collect: { kind: 'first' } })
    expect(first).toBe('U2')
    const race = await bus.emitCollect('user.login', ['u3'], { collect: { kind: 'race' } })
    expect(race).toBe('u3-ok')
    const reduced = await bus.emitCollect('user.login', ['u4'], {
      collect: {
        kind: 'reduce',
        initial: '',
        reducer: (acc, cur) => `${acc}${String(cur)}|`,
      },
    })
    expect(reduced).toBe('U4|u4-ok|')
  })

  it('supports race strategy error and cancel branches', async () => {
    const raceBus = createEventBus<AppEvents>()
    raceBus.on('user.login', async () => {
      throw new Error('race fail')
    })
    await expect(
      raceBus.emitCollect('user.login', ['u1'], { collect: { kind: 'race' } }),
    ).rejects.toThrow(/race fail/)

    const cancelBus = createEventBus<AppEvents>({
      middleware: [
        async (ctx, next) => {
          ctx.cancel()
          await next()
        },
      ],
    })
    cancelBus.on('user.login', async () => 'never')
    await expect(
      cancelBus.emitCollect('user.login', ['u1'], { collect: { kind: 'race' } }),
    ).resolves.toBeUndefined()
    expect(cancelBus.metrics().droppedCount).toBe(1)
  })

  it('supports replay and sticky', async () => {
    const bus = createEventBus<AppEvents>({
      replay: { count: 2 },
      sticky: { enabled: true },
    })
    await bus.emit('user.login', ['a'])
    await bus.emit('user.login', ['b'])
    await bus.emit('user.login', ['c'])
    expect(bus.replayFor('user.login')).toEqual([['b'], ['c']])

    const called: string[] = []
    bus.on('user.login', ([id]) => called.push(id), { replay: true })
    expect(called).toEqual(['c', 'b'])
  })

  it('supports replay for onPattern subscriptions', async () => {
    const bus = createEventBus<AppEvents>({
      replay: { count: 3 },
      sticky: { enabled: true },
    })
    await bus.emit('user.login', ['u1'])
    await bus.emit('user.logout', ['u1'])

    const wildcard = vi.fn()
    bus.onPattern('user.*', wildcard, { replay: true })

    expect(wildcard).toHaveBeenCalledTimes(2)
    expect(wildcard.mock.calls[0][0]).toEqual(['user.login', 'u1'])
    expect(wildcard.mock.calls[1][0]).toEqual(['user.logout', 'u1'])
  })

  it('supports retry and timeout policy', async () => {
    const bus = createEventBus<AppEvents>()
    const flaky = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce('ok')
    bus.on('user.login', () => flaky(), { retry: { times: 1 } })
    const collected = await bus.emitCollect('user.login', ['u1'])
    expect(collected).toEqual(['ok'])
    expect(flaky).toHaveBeenCalledTimes(2)
  })

  it('supports cancellation by AbortSignal', async () => {
    const bus = createEventBus<AppEvents>()
    bus.on('user.login', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      return 'done'
    })
    const controller = new AbortController()
    controller.abort()
    await expect(
      bus.emitCollect('user.login', ['u1'], { signal: controller.signal }),
    ).rejects.toThrow(/aborted/)
  })

  it('supports group/tag unsubscribe and pause/resume', async () => {
    const bus = createEventBus<AppEvents>()
    const h1 = vi.fn()
    const h2 = vi.fn()
    const h3 = vi.fn()
    bus.on('user.login', h1, { group: 'g1', tags: ['auth'] })
    bus.on('user.login', h2, { group: 'g2', tags: ['audit'] })
    bus.onPattern('user.*', h3)
    bus.offGroup('g1')
    bus.unsubscribeByTag('audit')
    bus.pause('user.*')
    await bus.emit('user.login', ['u1'])
    expect(h1).not.toHaveBeenCalled()
    expect(h2).not.toHaveBeenCalled()
    expect(h3).not.toHaveBeenCalled()
    bus.resume('user.*')
    await bus.emit('user.login', ['u1'])
    expect(h3).toHaveBeenCalledTimes(1)
  })

  it('collects metrics and supports in-memory adapter', async () => {
    const reporter = { onEmit: vi.fn(), onHandled: vi.fn(), onError: vi.fn() }
    const adapter = new InMemoryAdapter<AppEvents>()
    const bus = createEventBus<AppEvents>({ reporter, adapters: [adapter] })
    const handler = vi.fn()
    bus.on('user.login', handler)
    await bus.emit('user.login', ['u1'])
    expect(handler).toHaveBeenCalledTimes(1)
    expect(bus.metrics().emitCount).toBe(1)
    expect(reporter.onEmit).toHaveBeenCalled()
    await bus.destroy()
  })

  it('supports once option and listenerCount by pattern', async () => {
    const bus = createEventBus<AppEvents>()
    const onceHandler = vi.fn()
    bus.on('user.login', onceHandler, { once: true })
    expect(bus.listenerCount('user.login')).toBe(1)
    await bus.emit('user.login', ['u1'])
    await bus.emit('user.login', ['u2'])
    expect(onceHandler).toHaveBeenCalledTimes(1)
    expect(bus.listenerCount('user.login')).toBe(0)
  })

  it('respects paused option and unsubscribe function', async () => {
    const bus = createEventBus<AppEvents>()
    const paused = vi.fn()
    const active = vi.fn()
    bus.on('user.login', paused, { paused: true })
    const unsubscribe = bus.on('user.login', active)

    await bus.emit('user.login', ['u1'])
    expect(paused).not.toHaveBeenCalled()
    expect(active).toHaveBeenCalledTimes(1)

    unsubscribe()
    await bus.emit('user.login', ['u2'])
    expect(active).toHaveBeenCalledTimes(1)
  })

  it('tracks failed and dropped metrics, and logs in debug mode', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const bus = createEventBus<AppEvents>({ debug: true })
    bus.on('user.login', async () => {
      throw new Error('x')
    })
    await expect(bus.emit('user.login', ['u1'])).rejects.toThrow()
    expect(errorSpy).toHaveBeenCalled()
    expect(bus.metrics().failedCount).toBe(1)
    errorSpy.mockRestore()

    const bus2 = createEventBus<AppEvents>({
      middleware: [
        async (ctx, next) => {
          ctx.cancel()
          await next()
        },
      ],
    })
    bus2.on('user.login', vi.fn())
    await bus2.emit('user.login', ['u1'])
    expect(bus2.metrics().droppedCount).toBe(1)
  })

  it('prevents public API usage after destroy', async () => {
    const bus = createEventBus<AppEvents>()
    await bus.destroy()
    await expect(bus.emit('user.login', ['u1'])).rejects.toThrow(/destroyed/)
    expect(() => bus.on('user.login', vi.fn())).toThrow(/destroyed/)
    expect(() => bus.metrics()).toThrow(/destroyed/)
  })

  it('reuses destroy promise while destroying', async () => {
    let resolveStop: (() => void) | undefined
    const stopDone = new Promise<void>((resolve) => {
      resolveStop = resolve
    })
    const adapter: EventAdapter<AppEvents> = {
      name: 'slow-stop-adapter',
      start() {},
      async stop() {
        await stopDone
      },
      publish() {},
    }

    const bus = createEventBus<AppEvents>({ adapters: [adapter] })
    const first = bus.destroy()
    const second = bus.destroy()
    resolveStop?.()
    await Promise.all([first, second])
  })

  it('surfaces adapter start failure with adapter name', async () => {
    const badAdapter: EventAdapter<AppEvents> = {
      name: 'bad-adapter',
      async start() {
        throw new Error('bootstrap failed')
      },
      stop() {},
      publish() {},
    }
    const bus = createEventBus<AppEvents>({ adapters: [badAdapter] })
    await expect(bus.emit('user.login', ['u1'])).rejects.toThrow(/bad-adapter/)
    await bus.destroy()
  })

  it('publishes only to non in-memory adapters', async () => {
    const publishSpy = vi.fn()
    const adapter: EventAdapter<AppEvents> = {
      name: 'custom-adapter',
      start() {},
      stop() {},
      publish: publishSpy,
    }
    const bus = createEventBus<AppEvents>({
      adapters: [new InMemoryAdapter<AppEvents>(), adapter],
    })
    await bus.emit('user.login', ['u1'])
    expect(publishSpy).toHaveBeenCalledTimes(1)
    await bus.destroy()
  })

  it('validates runtime event and payload inputs', async () => {
    const bus = createEventBus<AppEvents>()
    await expect(bus.emit('' as keyof AppEvents & string, ['u1'])).rejects.toThrow(
      /non-empty string/,
    )
    await expect(
      bus.emit('user.login', 'u1' as unknown as AppEvents['user.login']),
    ).rejects.toThrow(/payload must be an array/)
    expect(() => bus.on('' as keyof AppEvents & string, vi.fn())).toThrow(/non-empty string/)
    expect(() => bus.onPattern('', vi.fn())).toThrow(/non-empty string/)
  })

  it('ignores malformed adapter envelopes', async () => {
    let onEnvelope: ((value: unknown) => void | Promise<void>) | undefined
    const adapter: EventAdapter<AppEvents> = {
      name: 'malformed-adapter',
      start(cb) {
        onEnvelope = cb as (value: unknown) => void | Promise<void>
      },
      stop() {},
      publish() {},
    }

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const bus = createEventBus<AppEvents>({ adapters: [adapter], debug: true })
    const login = vi.fn()
    bus.on('user.login', login)

    await onEnvelope?.({ type: 'unknown', event: '', payload: 'bad' })
    await onEnvelope?.({
      type: 'emit',
      event: 'user.login',
      payload: ['u1'],
      meta: { source: 1, tags: ['ok'] },
    })
    await onEnvelope?.({
      type: 'emit',
      event: 'user.login',
      payload: ['u1'],
      trace: { traceId: 'ok', spanId: 1 },
    })
    await onEnvelope?.({
      type: 'emit',
      event: 'user.login',
      payload: ['u1'],
      meta: { source: 'adapter', tags: ['x'] },
      trace: { traceId: 't-1', spanId: 's-1' },
    })
    expect(login).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('rejects queued concurrency task when handler fails', async () => {
    const bus = createEventBus<AppEvents>()
    bus.on(
      'user.login',
      async ([id]) => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        if (id === 'bad') throw new Error('queued fail')
        return id
      },
      { concurrency: 1 },
    )

    const first = bus.emitCollect('user.login', ['ok'])
    const second = bus.emitCollect('user.login', ['bad'])
    await expect(first).resolves.toEqual(['ok'])
    await expect(second).rejects.toThrow(/queued fail/)
  })
})
