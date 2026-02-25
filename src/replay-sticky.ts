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
    const cleaned = this.pruneByTtl(list)
    if (cleaned.length !== list.length) {
      if (cleaned.length > 0) {
        this.replayMap.set(event, cleaned)
      } else {
        this.replayMap.delete(event)
      }
    }
    if (cleaned.length === 0) return []
    return cleaned.map((item) => item.payload as Events[K])
  }

  stickyFor<K extends EventKey<Events>>(event: K): Events[K] | undefined {
    return this.stickyMap.get(event) as Events[K] | undefined
  }

  replayWithStickyFor<K extends EventKey<Events>>(event: K): Array<Events[K]> {
    const replayList = this.replayFor(event)
    const sticky = this.stickyFor(event)
    if (!sticky) return replayList
    return [sticky, ...replayList.filter((payload) => !this.samePayload(payload, sticky))]
  }

  replayWithStickyByPattern(patternMatch: (event: string) => boolean): Array<{
    event: EventKey<Events>
    payload: Events[EventKey<Events>]
  }> {
    const keys = new Set<string>([...this.replayMap.keys(), ...this.stickyMap.keys()])
    const entries: Array<{ event: EventKey<Events>; payload: Events[EventKey<Events>] }> = []

    for (const event of keys) {
      if (!patternMatch(event)) continue
      const eventKey = event as EventKey<Events>
      const payloads = this.replayWithStickyFor(eventKey) as Array<Events[EventKey<Events>]>
      for (const payload of payloads) {
        entries.push({ event: eventKey, payload })
      }
    }

    return entries
  }

  private samePayload(a: unknown[], b: unknown[]): boolean {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i += 1) {
      if (!Object.is(a[i], b[i])) return false
    }
    return true
  }

  private pruneByTtl(list: ReplayItem[]): ReplayItem[] {
    if (this.replayPolicy?.ttlMs === undefined) return list
    const ttl = this.replayPolicy.ttlMs
    const now = Date.now()
    return list.filter((item) => now - item.timestamp <= ttl)
  }
}
