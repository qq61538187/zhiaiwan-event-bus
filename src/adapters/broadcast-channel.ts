import type { AdapterEnvelope, EventAdapter, EventMap } from '../types'

export class BroadcastChannelAdapter<Events extends EventMap> implements EventAdapter<Events> {
  name = 'broadcast-channel'
  private channel?: BroadcastChannel
  private onEnvelope?: (envelope: AdapterEnvelope<Events>) => void

  constructor(private readonly channelName = 'event-bus') {}

  start(onEnvelope: (envelope: AdapterEnvelope<Events>) => void): void {
    this.onEnvelope = onEnvelope
    if (typeof BroadcastChannel === 'undefined') return
    this.channel = new BroadcastChannel(this.channelName)
    this.channel.onmessage = (event: MessageEvent<AdapterEnvelope<Events>>) => {
      this.onEnvelope?.(event.data)
    }
  }

  stop(): void {
    this.channel?.close()
    this.channel = undefined
    this.onEnvelope = undefined
  }

  publish(envelope: AdapterEnvelope<Events>): void {
    this.channel?.postMessage(envelope)
  }
}
