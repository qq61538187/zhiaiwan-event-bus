# @zhiaiwan/event-bus

[![npm version](https://img.shields.io/npm/v/@zhiaiwan/event-bus)](https://www.npmjs.com/package/@zhiaiwan/event-bus)
[![npm downloads](https://img.shields.io/npm/dm/@zhiaiwan/event-bus)](https://www.npmjs.com/package/@zhiaiwan/event-bus)
[![CI](https://github.com/qq61538187/zhiaiwan-event-bus/actions/workflows/ci.yml/badge.svg)](https://github.com/qq61538187/zhiaiwan-event-bus/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

[中文](./README.md) | **English**

Full-scenario, type-safe event bus with pattern matching, middleware pipeline, `emitCollect`, replay/sticky, execution policies (timeout/retry/cancel/concurrency), cross-runtime adapters, and observability.

## Installation

```bash
pnpm add @zhiaiwan/event-bus
```

## Quick Start

```ts
import { createEventBus } from '@zhiaiwan/event-bus'

type Events = {
  'user.login': [id: string]
  'order.created': [orderId: string, amount: number]
}

const bus = createEventBus<Events>({
  replay: { count: 20 },
  sticky: { enabled: true },
})

bus.on('user.login', ([id]) => {
  console.log('login', id)
})

bus.onPattern('order.*', ([event, orderId, amount]) => {
  console.log(event, orderId, amount)
})

await bus.emit('user.login', ['u1'])
```

## Full Configuration

```ts
import {
  BroadcastChannelAdapter,
  InMemoryAdapter,
  createEventBus,
} from '@zhiaiwan/event-bus'

const bus = createEventBus({
  debug: false,
  replay: { count: 50, ttlMs: 60_000 },
  sticky: { enabled: true },
  middleware: [
    async (ctx, next) => {
      // auth, tracing, short-circuit control
      await next()
    },
  ],
  adapters: [
    new InMemoryAdapter(),
    new BroadcastChannelAdapter('event-bus'),
  ],
  reporter: {
    onEmit: (event) => console.log('emit', event),
    onHandled: (event, durationMs) => console.log('handled', event, durationMs),
    onError: (event, error) => console.error('error', event, error),
  },
})
```

## API

### `createEventBus<Events>(options?)`

Factory function that creates an `EventBusInstance`.

```ts
const bus = createEventBus<Events>(
  options?: EventBusOptions<Events>,
): EventBusInstance<Events>
```

Parameters:

- `options.debug`: enable debug logging
- `options.middleware`: middleware pipeline in registration order
- `options.replay` / `options.sticky`: replay and sticky policies
- `options.adapters`: cross-runtime transport adapters
- `options.reporter`: metrics callbacks

### `bus.on(event, handler, options?)`

Subscribe to an exact event name and returns an unsubscribe function.

```ts
const unsubscribe = bus.on(
  event,
  handler,
  options?: SubscriptionOptions,
): Unsubscribe
```

- `event`: strongly typed event name
- `handler(payload, ctx)`: listener function
- `options`: listener policies (priority/retry/timeout/group/tags/concurrency/replay)

```ts
const off = bus.on('user.login', async ([id], ctx) => {
  console.log(id, ctx.meta.timestamp)
}, {
  priority: 10,
  retry: { times: 2, backoff: 'exponential', delayMs: 100 },
  timeoutMs: 2000,
  group: 'auth',
  tags: ['critical'],
})

off()
```

### `bus.onPattern(pattern, handler, options?)`

Subscribe by pattern (supports `*` / `**`) and returns an unsubscribe function.

```ts
const unsubscribe = bus.onPattern(
  pattern,
  handler,
  options?: SubscriptionOptions,
): Unsubscribe
```

- `pattern`: e.g. `order.*`, `order.**`
- `handler([event, ...payload], ctx)`: first item is matched event name

```ts
bus.onPattern('order.*', ([event, orderId]) => {
  console.log(event, orderId)
})
```

### `bus.emit(event, payload, options?)`

Emit an event.

```ts
const matched = await bus.emit(
  event,
  payload,
  options?: EmitOptions,
): Promise<boolean>
```

Returns:

- `true`: at least one listener matched
- `false`: no listener matched

```ts
const matched = await bus.emit('order.created', ['o-1', 99], {
  meta: { source: 'checkout', tags: ['pay'] },
  trace: { traceId: 't-1', spanId: 's-1' },
})
```

### `bus.emitCollect(event, payload, options?)`

Emit an event and aggregate listener results.

```ts
const result = await bus.emitCollect(
  event,
  payload,
  options?: EmitOptions,
): Promise<CollectResult>
```

`collect` strategies:

- `array`: return all values as an array (default)
- `first`: return first value
- `race`: return fastest value
- `reduce`: aggregate with reducer

```ts
const total = await bus.emitCollect('price.calc', [100], {
  collect: {
    kind: 'reduce',
    initial: 0,
    reducer: (acc, cur) => acc + Number(cur ?? 0),
  },
})
```

### `bus.offGroup(group)` / `bus.unsubscribeByTag(tag)`

Batch unsubscribe by group or tag.

### `bus.pause(pattern)` / `bus.resume(pattern)`

Pause or resume listeners under a pattern.

### `bus.eventNames()` / `bus.listenerCount(pattern?)`

Get current registered patterns and listener counts.

### `bus.replayFor(event)`

Read replay cache of a specific event.

### `bus.metrics()`

Returns metrics snapshot: `emitCount` / `handledCount` / `failedCount` / `droppedCount` / `avgHandlerDurationMs`.

### `bus.destroy()`

Destroys the instance and disposes adapter resources.

## API Snippets

```ts
// group unsubscribe
bus.offGroup('auth')

// tag unsubscribe
bus.unsubscribeByTag('critical')

// pause / resume
bus.pause('order.**')
bus.resume('order.**')

// runtime info
const names = bus.eventNames()
const count = bus.listenerCount()
const replay = bus.replayFor('order.created')
const snapshot = bus.metrics()

// dispose
await bus.destroy()
```

## Configuration Table

### `EventBusOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `debug` | `boolean` | `false` | Enable debug logging |
| `middleware` | `Middleware[]` | `[]` | Middleware pipeline in registration order |
| `replay` | `ReplayPolicy` | `undefined` | Replay cache policy |
| `sticky` | `StickyPolicy` | `undefined` | Sticky cache policy |
| `adapters` | `EventAdapter[]` | `[InMemoryAdapter]` | Transport adapters |
| `reporter` | `MetricsReporter` | `undefined` | Metrics callbacks |

`ReplayPolicy`:

| Field | Type | Default | Description |
|---|---|---|---|
| `count` | `number` | `undefined` | Max history entries per event |
| `ttlMs` | `number` | `undefined` | Replay entry TTL in milliseconds |

`StickyPolicy`:

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `false` | Enable sticky mode (keep latest entry only) |

### `SubscriptionOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `once` | `boolean` | `false` | Auto remove after first trigger |
| `priority` | `number` | `0` | Priority (higher runs first) |
| `paused` | `boolean` | `false` | Initial paused state |
| `timeoutMs` | `number` | `undefined` | Per-listener timeout in milliseconds |
| `retry` | `number \| RetryConfig` | `undefined` | Retry policy |
| `concurrency` | `number` | `undefined` | Per-listener concurrency limit |
| `group` | `string` | `undefined` | Group key (for `offGroup`) |
| `tags` | `string[]` | `undefined` | Tag list (for `unsubscribeByTag`) |
| `replay` | `boolean` | `false` | Replay cached/sticky events on subscribe |

`RetryConfig`:

| Field | Type | Default | Description |
|---|---|---|---|
| `times` | `number` | required | Max retry attempts |
| `delayMs` | `number` | `0` | Initial retry delay in milliseconds |
| `backoff` | `'fixed' \| 'linear' \| 'exponential'` | `'fixed'` | Backoff strategy |

### `EmitOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `signal` | `AbortSignal` | `undefined` | Abort current emit |
| `timeoutMs` | `number` | `undefined` | Emit-level timeout (reserved in current implementation) |
| `collect` | `CollectStrategy` | `{ kind: 'array' }` | Aggregation strategy for `emitCollect` |
| `trace` | `TraceContext` | `undefined` | Distributed trace metadata |
| `meta` | `Omit<EventMeta, 'timestamp'>` | `undefined` | Extra metadata (`timestamp` is injected automatically) |

`CollectStrategy`:

| Option | Description |
|---|---|
| `{ kind: 'array' }` | Return all listener values as array |
| `{ kind: 'first' }` | Return first value |
| `{ kind: 'race' }` | Return fastest value |
| `{ kind: 'reduce', initial, reducer }` | Aggregate values with reducer |

## Exports

### Core API

- `createEventBus`
- `EventBus`

### Adapters

- `InMemoryAdapter`
- `BroadcastChannelAdapter`
- `WebWorkerAdapter`
- `NodeWorkerThreadsAdapter`

### Utilities

- `isPatternMatch`
- `patternToRegExp`

### Type Exports

- `EventMap`, `EventBusOptions`, `EventBusInstance`
- `SubscriptionOptions`, `EmitOptions`
- `CollectStrategy`, `CollectResult`
- `EventAdapter`, `MetricsSnapshot`, `MetricsReporter`
- plus all public types from `src/types.ts`

### Import Example

```ts
import {
  BroadcastChannelAdapter,
  createEventBus,
  isPatternMatch,
  type EmitOptions,
  type EventMap,
  type SubscriptionOptions,
} from '@zhiaiwan/event-bus'

type Events = {
  'user.login': [id: string]
}

const bus = createEventBus<Events>({
  adapters: [new BroadcastChannelAdapter('app-bus')],
})

const matched = isPatternMatch('user.*', 'user.login')
console.log('pattern matched:', matched)
```

## Examples

```bash
pnpm run build
pnpm run examples
```

Open `http://localhost:3000` to view:

| Example | Scenario | Coverage |
|---|---|---|
| `basic` | Basic publish/subscribe | `on` / `emit` quick usage |
| `pattern-matching` | Pattern matching | exact event + `*` / `**` |
| `pattern-utils` | Utility functions | `isPatternMatch` / `patternToRegExp` |
| `emit-collect` | Result aggregation | `array` / `first` / `race` / `reduce` |
| `replay-sticky` | Event replay | replay + sticky |
| `policies` | Execution policies | timeout / retry / cancel / concurrency |
| `adapters-browser` | Browser multi-instance messaging | InMemory + BroadcastChannel + WebWorker |
| `adapters-node-worker` | Node multi-thread messaging | interactive worker_threads adapter validation + Node script execution |
| `observability` | Observability | middleware + metrics + trace/reporter |
| `async` | Async listeners | Promise-based handler flows |
| `error` | Error handling | listener failures and fallback behavior |
| `priority-context` | Priority and context | priority + handler context |
| `namespace` | Event namespace | dot-style event grouping |
| `lifecycle` | Lifecycle control | pause / resume / destroy |
| `introspection` | Runtime inspection | eventNames / listenerCount / replayFor / metrics |

### Coverage Matrix (Scenario × API × Example × Test)

| Scenario | API | Example | Test |
|---|---|---|---|
| Basic subscribe/emit | `on` / `emit` / `once` | `basic` | `tests/event-bus.test.ts` |
| Pattern subscribe/match | `onPattern` / `isPatternMatch` / `patternToRegExp` | `pattern-matching` + `pattern-utils` | `tests/event-bus.test.ts` + `tests/pattern-matcher.test.ts` |
| Collect strategies | `emitCollect` (`array/first/reduce`) | `emit-collect` | `tests/event-bus.test.ts` |
| Replay/sticky | `replay` / `sticky` / `replayFor` | `replay-sticky` | `tests/event-bus.test.ts` |
| Execution control | `timeoutMs` / `retry` / `concurrency` / `signal` | `policies` | `tests/event-bus.test.ts` + `tests/policies.test.ts` |
| Lifecycle management | `pause` / `resume` / `offGroup` / `unsubscribeByTag` / `destroy` | `lifecycle` | `tests/event-bus.test.ts` |
| Runtime introspection | `eventNames` / `listenerCount` / `metrics` | `introspection` | `tests/event-bus.test.ts` |
| Observability extension | `middleware` / `reporter` / `trace` / `meta` | `observability` | `tests/event-bus.test.ts` |
| Cross-runtime adapters | `InMemoryAdapter` / `BroadcastChannelAdapter` / `WebWorkerAdapter` / `NodeWorkerThreadsAdapter` | `adapters-browser` + `adapters-node-worker` | `tests/adapters.test.ts` |

## Project Structure

| Path | Purpose | Public for consumers |
|---|---|---|
| `src/index.ts` | Package entry; re-exports API and types | Yes (npm public entry) |
| `src/core.ts` | EventBus main implementation (subscribe/emit/collect/lifecycle) | No (internal) |
| `src/types.ts` | Full type contracts (Options/Context/Adapter/Metrics) | Yes (type exports) |
| `src/matcher.ts` | Pattern matching and RegExp conversion helpers | Yes (utility exports) |
| `src/store.ts` | Listener storage and matching internals | No (internal) |
| `src/policy.ts` | timeout/retry/concurrency execution policies | No (internal) |
| `src/replay-sticky.ts` | replay/sticky caching internals | No (internal) |
| `src/reporter.ts` | metrics aggregation and reporter hooks | No (internal) |
| `src/adapters/` | Cross-runtime adapter implementations | Yes (adapter class exports) |
| `tests/` | Unit tests (core/matcher/policies/adapters) | No |
| `examples/` | Interactive demos (browser + worker scenarios) | No (docs/demo assets) |
| `dist/` | Build outputs for publishing | Yes (published artifacts) |
| `README.md` / `README.en.md` | Chinese/English documentation | Yes |

## FAQ

### 1) What is the difference between `*` and `**`?

- `*`: matches a single segment. Example: `order.*` matches `order.created`, but not `order.pay.success`.
- `**`: matches multiple segments. Example: `order.**` matches both `order.created` and `order.pay.success`.

### 2) When should I use `emit` vs `emitCollect`?

- Use `emit` when you only care whether any listener matched (`boolean` result).
- Use `emitCollect` when you need listener return values and aggregation (`array/first/race/reduce`).

### 3) When should replay/sticky be enabled?

- `replay`: enable when late subscribers need historical events (event sourcing style scenarios).
- `sticky`: enable when late subscribers only need the latest state (state sync scenarios).
- They can be used together: latest value via sticky + historical stream via replay.

### 4) How do I choose an adapter?

- Single process: default `InMemoryAdapter`
- Multi-tab browser communication: `BroadcastChannelAdapter`
- Browser Worker communication: `WebWorkerAdapter`
- Node multi-thread communication: `NodeWorkerThreadsAdapter`

### 5) How can I improve listener execution reliability?

- Use `timeoutMs` to cap single-listener execution time.
- Use `retry` for failure retries (fixed/linear/exponential backoff).
- Use `concurrency` to limit per-listener parallelism under burst traffic.

### 6) How do I troubleshoot runtime behavior?

- `eventNames()`: inspect registered patterns
- `listenerCount(pattern?)`: verify listener counts
- `replayFor(event)`: inspect replay cache
- `metrics()`: inspect emit/handled/failed/dropped and average latency

## Development Commands

```bash
pnpm run lint
pnpm run typecheck
pnpm run test:run
pnpm run build
```

## Tech Stack

- Build: Vite + vite-plugin-dts
- Test: Vitest + @vitest/coverage-v8
- Lint/Format: Biome + Commitlint + Husky
- Release: Changesets + GitHub Actions

## License

[MIT](./LICENSE)
