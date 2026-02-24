import type { AdapterEnvelope, EventAdapter, EventMap } from '../types'

type NodePortLike<Events extends EventMap> = {
  on: (event: 'message', handler: (value: AdapterEnvelope<Events>) => void) => void
  postMessage: (value: AdapterEnvelope<Events>) => void
  off?: (event: 'message', handler: (value: AdapterEnvelope<Events>) => void) => void
}

export class NodeWorkerThreadsAdapter<Events extends EventMap> implements EventAdapter<Events> {
  name = 'node-worker-threads'
  private onEnvelope?: (envelope: AdapterEnvelope<Events>) => void
  private listener?: (value: AdapterEnvelope<Events>) => void

  constructor(private readonly port: NodePortLike<Events>) {}

  start(onEnvelope: (envelope: AdapterEnvelope<Events>) => void): void {
    this.onEnvelope = onEnvelope
    this.listener = (value) => this.onEnvelope?.(value)
    this.port.on('message', this.listener)
  }

  stop(): void {
    if (this.listener && this.port.off) {
      this.port.off('message', this.listener)
    }
    this.listener = undefined
    this.onEnvelope = undefined
  }

  publish(envelope: AdapterEnvelope<Events>): void {
    this.port.postMessage(envelope)
  }
}
