export type EventMap = Record<string, unknown[]>
export type Pattern = string
export type EventKey<Events extends EventMap> = keyof Events & string
export type EventTuple<Events extends EventMap, K extends EventKey<Events>> = [K, ...Events[K]]
export type EmitInput<Events extends EventMap> = {
  [K in EventKey<Events>]: EventTuple<Events, K>
}[EventKey<Events>]
export type EventHandler<Events extends EventMap, K extends EventKey<Events>, Result = unknown> = (
  payload: Events[K],
  ctx: HandlerContext<Events, K>,
) => Result | Promise<Result>
export type PatternHandler<Events extends EventMap, Result = unknown> = (
  event: EmitInput<Events>,
  ctx: HandlerContext<Events, EventKey<Events>>,
) => Result | Promise<Result>

export interface TraceContext {
  traceId?: string
  spanId?: string
  parentSpanId?: string
}

export interface EventMeta {
  timestamp: number
  source?: string
  tags?: string[]
}

export interface EmitContext<Events extends EventMap, K extends EventKey<Events>> {
  event: K
  payload: Events[K]
  signal?: AbortSignal
  meta: EventMeta
  trace?: TraceContext
  cancelled: boolean
  cancel: () => void
}

export interface HandlerContext<Events extends EventMap, K extends EventKey<Events>> {
  event: K
  signal?: AbortSignal
  trace?: TraceContext
  meta: EventMeta
  attempt: number
}

export type Middleware<Events extends EventMap = EventMap> = <K extends EventKey<Events>>(
  ctx: EmitContext<Events, K>,
  next: () => Promise<void>,
) => Promise<void> | void

export type RetryConfig = {
  times?: number
  delayMs?: number
  backoff?: 'fixed' | 'linear' | 'exponential'
  jitterMs?: number
  profile?: 'aggressive' | 'balanced' | 'conservative'
  shouldRetry?: (error: unknown, attempt: number) => boolean | Promise<boolean>
}

export type CollectStrategy<T = unknown, R = unknown> =
  | { kind: 'array' }
  | { kind: 'first' }
  | { kind: 'race' }
  | { kind: 'reduce'; initial: R; reducer: (acc: R, current: T) => R }

export type CollectResult<T = unknown, R = unknown> = T[] | T | R | undefined
export interface ReplayPolicy {
  count?: number
  ttlMs?: number
}
export interface StickyPolicy {
  enabled: boolean
}

export interface SubscriptionOptions {
  once?: boolean
  priority?: number
  paused?: boolean
  timeoutMs?: number
  retry?: number | RetryConfig
  concurrency?: number
  group?: string
  tags?: string[]
  replay?: boolean
}

export interface EmitOptions {
  signal?: AbortSignal
  timeoutMs?: number
  collect?: CollectStrategy
  trace?: TraceContext
  meta?: Omit<EventMeta, 'timestamp'>
}

export type Unsubscribe = () => void
export interface SubscriptionGroup {
  add(unsubscribe: Unsubscribe): void
  unsubscribeAll(): void
}

export interface ListenerEntry<Events extends EventMap = EventMap> {
  id: string
  pattern: Pattern
  paused: boolean
  options: Required<Pick<SubscriptionOptions, 'once' | 'priority'>> &
    Omit<SubscriptionOptions, 'once' | 'priority'>
  queueActive: number
  queuePending: Array<() => Promise<void>>
  handler: EventHandler<Events, EventKey<Events>, unknown> | PatternHandler<Events, unknown>
  isPattern: boolean
}

export interface AdapterEnvelope<Events extends EventMap = EventMap> {
  type: 'emit'
  event: EventKey<Events>
  payload: unknown[]
  meta?: Omit<EventMeta, 'timestamp'>
  trace?: TraceContext
}

export interface EventAdapter<Events extends EventMap = EventMap> {
  name: string
  start(onEnvelope: (envelope: AdapterEnvelope<Events>) => void): void | Promise<void>
  stop(): void | Promise<void>
  publish(envelope: AdapterEnvelope<Events>): void | Promise<void>
}

export interface MetricsSnapshot {
  emitCount: number
  handledCount: number
  failedCount: number
  droppedCount: number
  avgHandlerDurationMs: number
}

export interface MetricsReporter {
  onEmit?(event: string): void
  onHandled?(event: string, durationMs: number): void
  onError?(event: string, error: unknown): void
}

export interface EventBusOptions<Events extends EventMap = EventMap> {
  debug?: boolean
  middleware?: Middleware<Events>[]
  replay?: ReplayPolicy
  sticky?: StickyPolicy
  adapters?: EventAdapter<Events>[]
  reporter?: MetricsReporter
}

export interface EventBusInstance<Events extends EventMap = EventMap> {
  on<K extends EventKey<Events>>(
    event: K,
    handler: EventHandler<Events, K, unknown>,
    options?: SubscriptionOptions,
  ): Unsubscribe
  onPattern(
    pattern: Pattern,
    handler: PatternHandler<Events, unknown>,
    options?: SubscriptionOptions,
  ): Unsubscribe
  emit<K extends EventKey<Events>>(
    event: K,
    payload: Events[K],
    options?: EmitOptions,
  ): Promise<boolean>
  emitCollect<K extends EventKey<Events>>(
    event: K,
    payload: Events[K],
    options?: EmitOptions,
  ): Promise<CollectResult>
  offGroup(group: string): void
  pause(pattern: Pattern): void
  resume(pattern: Pattern): void
  unsubscribeByTag(tag: string): void
  eventNames(): string[]
  listenerCount(pattern?: Pattern): number
  replayFor<K extends EventKey<Events>>(event: K): Array<Events[K]>
  metrics(): MetricsSnapshot
  destroy(): Promise<void>
}
