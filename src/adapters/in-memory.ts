import type { AdapterEnvelope, EventAdapter, EventMap } from '../types'

export class InMemoryAdapter<Events extends EventMap> implements EventAdapter<Events> {
  name = 'in-memory'
  private onEnvelope?: (envelope: AdapterEnvelope<Events>) => void

  start(onEnvelope: (envelope: AdapterEnvelope<Events>) => void): void {
    this.onEnvelope = onEnvelope
  }

  stop(): void {
    this.onEnvelope = undefined
  }

  publish(envelope: AdapterEnvelope<Events>): void {
    this.onEnvelope?.(envelope)
  }
}
