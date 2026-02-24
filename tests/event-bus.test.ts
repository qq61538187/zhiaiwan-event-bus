import { describe, expect, it, vi } from 'vitest'
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
    expect(called).toEqual(['c'])
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
})
