import type { EventKey, EventMap, ReplayPolicy, StickyPolicy } from './types'

type ReplayItem = {
  payload: unknown[]
  timestamp: number
}

export class ReplayStickyStore<Events extends EventMap> {
  private replayMap = new Map<string, ReplayItem[]>()
  private stickyMap = new Map<string, unknown[]>()

  constructor(
    private readonly replayPolicy: ReplayPolicy | undefined,
    private readonly stickyPolicy: StickyPolicy | undefined,
  ) {}

  push<K extends EventKey<Events>>(event: K, payload: Events[K]): void {
    const now = Date.now()
    if (this.replayPolicy) {
      const list = this.replayMap.get(event) ?? []
      list.push({ payload: [...payload], timestamp: now })
      const maxCount = this.replayPolicy.count ?? 50
      while (list.length > maxCount) list.shift()
      if (this.replayPolicy.ttlMs !== undefined) {
        const ttl = this.replayPolicy.ttlMs
        while (list.length > 0 && now - list[0].timestamp > ttl) list.shift()
      }
      this.replayMap.set(event, list)
    }
    if (this.stickyPolicy?.enabled) {
      this.stickyMap.set(event, [...payload])
    }
  }

  replayFor<K extends EventKey<Events>>(event: K): Array<Events[K]> {
    const list = this.replayMap.get(event) ?? []
    return list.map((item) => item.payload as Events[K])
  }

  stickyFor<K extends EventKey<Events>>(event: K): Events[K] | undefined {
    return this.stickyMap.get(event) as Events[K] | undefined
  }
}
