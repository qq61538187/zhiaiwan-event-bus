import { describe, expect, it, vi } from 'vitest'
import {
  BroadcastChannelAdapter,
  InMemoryAdapter,
  NodeWorkerThreadsAdapter,
  WebWorkerAdapter,
} from '../src'

type Events = {
  'user.login': [id: string]
}

const envelope = {
  type: 'emit' as const,
  event: 'user.login' as const,
  payload: ['u1'],
}

describe('adapters', () => {
  it('InMemoryAdapter should loopback envelope', () => {
    const adapter = new InMemoryAdapter<Events>()
    const onEnvelope = vi.fn()
    adapter.start(onEnvelope)
    adapter.publish(envelope)
    expect(onEnvelope).toHaveBeenCalledWith(envelope)
    adapter.stop()
  })

  it('BroadcastChannelAdapter should no-op safely without runtime support', () => {
    const original = globalThis.BroadcastChannel
    // @ts-expect-error force undefined runtime for test
    globalThis.BroadcastChannel = undefined
    const adapter = new BroadcastChannelAdapter<Events>('test-channel')
    const onEnvelope = vi.fn()
    adapter.start(onEnvelope)
    expect(() => adapter.publish(envelope)).not.toThrow()
    expect(() => adapter.stop()).not.toThrow()
    globalThis.BroadcastChannel = original
  })

  it('BroadcastChannelAdapter should receive messages when runtime exists', () => {
    const original = globalThis.BroadcastChannel
    class MockBroadcastChannel {
      onmessage: ((event: MessageEvent<typeof envelope>) => void) | null = null
      constructor(public _name: string) {}
      postMessage(_value: unknown) {}
      close() {}
    }
    // @ts-expect-error override for test runtime
    globalThis.BroadcastChannel = MockBroadcastChannel

    const adapter = new BroadcastChannelAdapter<Events>('demo')
    const onEnvelope = vi.fn()
    adapter.start(onEnvelope)

    const channel = (adapter as unknown as { channel: MockBroadcastChannel }).channel
    channel.onmessage?.({ data: envelope } as MessageEvent<typeof envelope>)
    expect(onEnvelope).toHaveBeenCalledWith(envelope)

    adapter.stop()
    globalThis.BroadcastChannel = original
  })

  it('WebWorkerAdapter should subscribe and publish via worker-like target', () => {
    let handler: ((event: MessageEvent<typeof envelope>) => void) | undefined
    const worker = {
      addEventListener: vi.fn((type: string, cb: unknown) => {
        if (type === 'message') handler = cb as typeof handler
      }),
      removeEventListener: vi.fn(),
      postMessage: vi.fn(),
    } as unknown as Worker

    const adapter = new WebWorkerAdapter<Events>(worker)
    const onEnvelope = vi.fn()
    adapter.start(onEnvelope)
    handler?.({ data: envelope } as MessageEvent<typeof envelope>)
    expect(onEnvelope).toHaveBeenCalledWith(envelope)
    adapter.publish(envelope)
    expect(worker.postMessage).toHaveBeenCalledWith(envelope)
    adapter.stop()
    expect(worker.removeEventListener).toHaveBeenCalled()
  })

  it('NodeWorkerThreadsAdapter should bind, publish and unbind', () => {
    let onMessage: ((value: typeof envelope) => void) | undefined
    const port = {
      on: vi.fn((_event: 'message', handler: (value: typeof envelope) => void) => {
        onMessage = handler
      }),
      postMessage: vi.fn(),
      off: vi.fn(),
    }
    const adapter = new NodeWorkerThreadsAdapter<Events>(port)
    const onEnvelope = vi.fn()
    adapter.start(onEnvelope)
    onMessage?.(envelope)
    expect(onEnvelope).toHaveBeenCalledWith(envelope)
    adapter.publish(envelope)
    expect(port.postMessage).toHaveBeenCalledWith(envelope)
    adapter.stop()
    expect(port.off).toHaveBeenCalled()
  })
})
