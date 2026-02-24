import type { AdapterEnvelope, EventAdapter, EventMap } from '../types'

type WorkerLike = Worker | MessagePort

export class WebWorkerAdapter<Events extends EventMap> implements EventAdapter<Events> {
  name = 'web-worker'
  private onEnvelope?: (envelope: AdapterEnvelope<Events>) => void
  private listener?: EventListener

  constructor(private readonly worker: WorkerLike) {}

  start(onEnvelope: (envelope: AdapterEnvelope<Events>) => void): void {
    this.onEnvelope = onEnvelope
    this.listener = ((event: MessageEvent<AdapterEnvelope<Events>>) => {
      this.onEnvelope?.(event.data)
    }) as EventListener
    this.worker.addEventListener('message', this.listener)
  }

  stop(): void {
    if (this.listener) {
      this.worker.removeEventListener('message', this.listener)
    }
    this.listener = undefined
    this.onEnvelope = undefined
  }

  publish(envelope: AdapterEnvelope<Events>): void {
    this.worker.postMessage(envelope)
  }
}
