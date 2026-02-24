import { InMemoryAdapter } from './adapters'
import { withRetry, withTimeout } from './policy'
import { ReplayStickyStore } from './replay-sticky'
import { MetricsState } from './reporter'
import { ListenerStore } from './store'
import type {
  CollectResult,
  CollectStrategy,
  EmitContext,
  EmitOptions,
  EventAdapter,
  EventBusInstance,
  EventBusOptions,
  EventHandler,
  EventKey,
  EventMap,
  EventMeta,
  HandlerContext,
  ListenerEntry,
  Middleware,
  Pattern,
  PatternHandler,
  SubscriptionOptions,
  Unsubscribe,
} from './types'

const DEFAULT_COLLECT: CollectStrategy = { kind: 'array' }

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeOptions(options: SubscriptionOptions | undefined): ListenerEntry['options'] {
  return {
    once: options?.once ?? false,
    priority: options?.priority ?? 0,
    paused: options?.paused ?? false,
    timeoutMs: options?.timeoutMs,
    retry: options?.retry,
    concurrency: options?.concurrency,
    group: options?.group,
    tags: options?.tags,
    replay: options?.replay,
  }
}

function makeMeta(options?: EmitOptions): EventMeta {
  return {
    timestamp: Date.now(),
    source: options?.meta?.source,
    tags: options?.meta?.tags,
  }
}

export class EventBus<Events extends EventMap> implements EventBusInstance<Events> {
  private readonly store = new ListenerStore<Events>()
  private readonly replaySticky: ReplayStickyStore<Events>
  private readonly metricsState: MetricsState
  private readonly middleware: Middleware<Events>[]
  private readonly adapters: EventAdapter<Events>[]
  private readonly debug: boolean

  constructor(options: EventBusOptions<Events> = {}) {
    this.middleware = options.middleware ?? []
    this.debug = options.debug ?? false
    this.replaySticky = new ReplayStickyStore(options.replay, options.sticky)
    this.metricsState = new MetricsState(options.reporter)
    this.adapters = options.adapters?.length ? options.adapters : [new InMemoryAdapter<Events>()]
    for (const adapter of this.adapters) {
      void adapter.start(async (envelope) => {
        // Re-delivered adapter events should not be published again,
        // otherwise cross-runtime adapters can form an infinite relay loop.
        await this.emitInternal(
          envelope.event as EventKey<Events>,
          envelope.payload as Events[EventKey<Events>],
          {
            meta: envelope.meta,
            trace: envelope.trace,
          },
          true,
        )
      })
    }
  }

  on<K extends EventKey<Events>>(
    event: K,
    handler: EventHandler<Events, K, unknown>,
    options?: SubscriptionOptions,
  ): Unsubscribe {
    const entry: ListenerEntry<Events> = {
      id: uid(),
      pattern: event,
      paused: options?.paused ?? false,
      options: normalizeOptions(options),
      queueActive: 0,
      queuePending: [],
      handler: handler as EventHandler<Events, EventKey<Events>, unknown>,
      isPattern: false,
    }
    this.store.add(entry)
    if (options?.replay) {
      const replayEvents = this.replaySticky.replayFor(event)
      const sticky = this.replaySticky.stickyFor(event)
      const firstPayload = sticky ? [sticky] : replayEvents
      for (const payload of firstPayload) {
        void this.invokeEntry(entry, event, payload, makeMeta(), undefined)
      }
    }
    return () => this.store.remove(entry.id)
  }

  onPattern(
    pattern: Pattern,
    handler: PatternHandler<Events, unknown>,
    options?: SubscriptionOptions,
  ): Unsubscribe {
    const entry: ListenerEntry<Events> = {
      id: uid(),
      pattern,
      paused: options?.paused ?? false,
      options: normalizeOptions(options),
      queueActive: 0,
      queuePending: [],
      handler,
      isPattern: true,
    }
    this.store.add(entry)
    return () => this.store.remove(entry.id)
  }

  async emit<K extends EventKey<Events>>(
    event: K,
    payload: Events[K],
    options?: EmitOptions,
  ): Promise<boolean> {
    const results = await this.emitInternal(event, payload, options)
    return results.matched > 0
  }

  async emitCollect<K extends EventKey<Events>>(
    event: K,
    payload: Events[K],
    options?: EmitOptions,
  ): Promise<CollectResult> {
    const strategy = options?.collect ?? DEFAULT_COLLECT
    if (strategy.kind === 'race') {
      return await this.emitInternalRace(event, payload, options)
    }
    const results = await this.emitInternal(event, payload, options)
    const values = results.values

    if (strategy.kind === 'array') return values
    if (strategy.kind === 'first') return values[0]
    let acc = strategy.initial
    for (const item of values) {
      acc = strategy.reducer(acc, item)
    }
    return acc
  }

  offGroup(group: string): void {
    this.store.removeByGroup(group)
  }

  pause(pattern: Pattern): void {
    this.store.pause(pattern)
  }

  resume(pattern: Pattern): void {
    this.store.resume(pattern)
  }

  unsubscribeByTag(tag: string): void {
    this.store.removeByTag(tag)
  }

  eventNames(): string[] {
    return this.store.patterns()
  }

  listenerCount(pattern?: Pattern): number {
    return this.store.count(pattern)
  }

  replayFor<K extends EventKey<Events>>(event: K): Array<Events[K]> {
    return this.replaySticky.replayFor(event)
  }

  metrics() {
    return this.metricsState.snapshot()
  }

  async destroy(): Promise<void> {
    this.store.clear()
    for (const adapter of this.adapters) {
      await adapter.stop()
    }
  }

  private async emitInternal<K extends EventKey<Events>>(
    event: K,
    payload: Events[K],
    options?: EmitOptions,
    suppressPublish = false,
  ): Promise<{ matched: number; values: unknown[] }> {
    const meta = makeMeta(options)
    this.replaySticky.push(event, payload)
    const matches = this.store.match(event)
    const values: unknown[] = []
    this.metricsState.onEmit(event)

    const ctx: EmitContext<Events, K> = {
      event,
      payload,
      signal: options?.signal,
      meta,
      trace: options?.trace,
      cancelled: false,
      cancel: () => {
        ctx.cancelled = true
      },
    }

    const run = async () => {
      for (const entry of matches) {
        if (ctx.cancelled) {
          this.metricsState.onDropped()
          break
        }
        const value = await this.invokeEntry(entry, event, payload, meta, options)
        values.push(value)
        if (entry.options.once) this.store.remove(entry.id)
      }
    }
    await this.runMiddleware(ctx, run)

    if (!suppressPublish) {
      await this.publishToAdapters(event, payload, options)
    }

    return { matched: matches.length, values }
  }

  private async emitInternalRace<K extends EventKey<Events>>(
    event: K,
    payload: Events[K],
    options?: EmitOptions,
  ): Promise<CollectResult> {
    const meta = makeMeta(options)
    this.replaySticky.push(event, payload)
    const matches = this.store.match(event)
    this.metricsState.onEmit(event)

    const wrappedRuns: Array<
      Promise<{ ok: true; value: unknown } | { ok: false; error: unknown }>
    > = []
    const ctx: EmitContext<Events, K> = {
      event,
      payload,
      signal: options?.signal,
      meta,
      trace: options?.trace,
      cancelled: false,
      cancel: () => {
        ctx.cancelled = true
      },
    }

    const run = async () => {
      for (const entry of matches) {
        if (ctx.cancelled) {
          this.metricsState.onDropped()
          break
        }
        const promise = this.invokeEntry(entry, event, payload, meta, options)
          .then((value) => {
            if (entry.options.once) this.store.remove(entry.id)
            return { ok: true as const, value }
          })
          .catch((error) => ({ ok: false as const, error }))
        wrappedRuns.push(promise)
      }
    }

    await this.runMiddleware(ctx, run)
    await this.publishToAdapters(event, payload, options)

    if (!wrappedRuns.length) return undefined

    const winner = await Promise.race(wrappedRuns)
    if (!winner.ok) throw winner.error
    return winner.value
  }

  private async publishToAdapters<K extends EventKey<Events>>(
    event: K,
    payload: Events[K],
    options?: EmitOptions,
  ): Promise<void> {
    const envelope = {
      type: 'emit' as const,
      event,
      payload: payload as unknown[],
      meta: options?.meta,
      trace: options?.trace,
    }
    for (const adapter of this.adapters) {
      if (adapter.name !== 'in-memory') {
        await adapter.publish(envelope)
      }
    }
  }

  private async runMiddleware<K extends EventKey<Events>>(
    ctx: EmitContext<Events, K>,
    run: () => Promise<void>,
  ): Promise<void> {
    let index = -1
    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) throw new Error('next() called multiple times')
      index = i
      const fn = this.middleware[i]
      if (!fn) {
        await run()
        return
      }
      await fn(ctx, () => dispatch(i + 1))
    }
    await dispatch(0)
  }

  private async invokeEntry<K extends EventKey<Events>>(
    entry: ListenerEntry<Events>,
    event: K,
    payload: Events[K],
    meta: EventMeta,
    options?: EmitOptions,
  ): Promise<unknown> {
    const task = async () => {
      const startedAt = performance.now()
      const run = async (attempt: number) => {
        const hctx: HandlerContext<Events, K> = {
          event,
          signal: options?.signal,
          trace: options?.trace,
          meta,
          attempt,
        }
        if (entry.isPattern) {
          return await (entry.handler as PatternHandler<Events, unknown>)([event, ...payload], hctx)
        }
        return await (entry.handler as EventHandler<Events, K, unknown>)(payload, hctx)
      }

      try {
        const value = await withRetry(
          (attempt) =>
            withTimeout(
              run(attempt),
              entry.options.timeoutMs ?? options?.timeoutMs,
              options?.signal,
            ),
          entry.options.retry,
        )
        this.metricsState.onHandled(event, performance.now() - startedAt)
        return value
      } catch (error) {
        this.metricsState.onError(event, error)
        if (this.debug) {
          console.error('[EventBus] handler error', event, error)
        }
        throw error
      }
    }

    return await this.runWithConcurrency(entry, task)
  }

  private async runWithConcurrency(
    entry: ListenerEntry<Events>,
    task: () => Promise<unknown>,
  ): Promise<unknown> {
    const limit = entry.options.concurrency
    if (!limit || limit <= 0) {
      return await task()
    }
    if (entry.queueActive < limit) {
      entry.queueActive += 1
      try {
        return await task()
      } finally {
        entry.queueActive -= 1
        const next = entry.queuePending.shift()
        if (next) void next()
      }
    }
    return await new Promise<unknown>((resolve, reject) => {
      entry.queuePending.push(async () => {
        try {
          resolve(await this.runWithConcurrency(entry, task))
        } catch (error) {
          reject(error)
        }
      })
    })
  }
}

export function createEventBus<Events extends EventMap = EventMap>(
  options?: EventBusOptions<Events>,
): EventBusInstance<Events> {
  return new EventBus<Events>(options)
}
