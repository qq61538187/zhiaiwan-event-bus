# @zhiaiwan/event-bus

[![npm version](https://img.shields.io/npm/v/@zhiaiwan/event-bus)](https://www.npmjs.com/package/@zhiaiwan/event-bus)
[![npm downloads](https://img.shields.io/npm/dm/@zhiaiwan/event-bus)](https://www.npmjs.com/package/@zhiaiwan/event-bus)
[![CI](https://github.com/qq61538187/zhiaiwan-event-bus/actions/workflows/ci.yml/badge.svg)](https://github.com/qq61538187/zhiaiwan-event-bus/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

**中文** | [English](./README.en.md)

面向全场景的类型安全事件总线，支持模式匹配、中间件管线、`emitCollect`、replay/sticky、策略控制（timeout/retry/cancel/concurrency）、跨运行时适配器与可观测能力。

## 安装

```bash
pnpm add @zhiaiwan/event-bus
```

## 快速开始

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

### 完整配置示例

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
      // 可在这里做鉴权、埋点、短路控制
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

工厂函数，创建 `EventBusInstance` 实例。

```ts
const bus = createEventBus<Events>(
  options?: EventBusOptions<Events>,
): EventBusInstance<Events>
```

参数说明：

- `options.debug`：是否开启调试日志
- `options.middleware`：中间件数组，按注册顺序执行
- `options.replay` / `options.sticky`：回放与粘性事件策略
- `options.adapters`：跨运行时传输适配器
- `options.reporter`：指标回调

### `bus.on(event, handler, options?)`

订阅精确事件名，返回取消订阅函数。

```ts
const unsubscribe = bus.on(
  event,
  handler,
  options?: SubscriptionOptions,
): Unsubscribe
```

- `event`：事件名（强类型）
- `handler(payload, ctx)`：事件处理函数
- `options`：订阅策略（优先级、重试、超时、分组、标签、并发、replay 等）

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

按模式订阅（支持 `*` / `**`），返回取消订阅函数。

```ts
const unsubscribe = bus.onPattern(
  pattern,
  handler,
  options?: SubscriptionOptions,
): Unsubscribe
```

- `pattern`：例如 `order.*`、`order.**`
- `handler([event, ...payload], ctx)`：首位为实际命中事件名

```ts
bus.onPattern('order.*', ([event, orderId]) => {
  console.log(event, orderId)
})
```

### `bus.emit(event, payload, options?)`

触发事件。

```ts
const matched = await bus.emit(
  event,
  payload,
  options?: EmitOptions,
): Promise<boolean>
```

返回值：

- `true`：至少命中一个监听器
- `false`：未命中监听器

```ts
const matched = await bus.emit('order.created', ['o-1', 99], {
  meta: { source: 'checkout', tags: ['pay'] },
  trace: { traceId: 't-1', spanId: 's-1' },
})
```

### `bus.emitCollect(event, payload, options?)`

触发事件并聚合监听器返回值。

```ts
const result = await bus.emitCollect(
  event,
  payload,
  options?: EmitOptions,
): Promise<CollectResult>
```

`collect` 聚合策略：

- `array`：返回所有结果数组（默认）
- `first`：返回第一个结果
- `race`：返回最快结果
- `reduce`：按 reducer 聚合结果

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

按 group 或 tag 批量取消订阅。

### `bus.pause(pattern)` / `bus.resume(pattern)`

暂停或恢复某个 pattern 下的监听器。

### `bus.eventNames()` / `bus.listenerCount(pattern?)`

获取当前 pattern 列表和监听器数量。

### `bus.replayFor(event)`

读取某事件当前 replay 缓存。

### `bus.metrics()`

获取指标快照：`emitCount` / `handledCount` / `failedCount` / `droppedCount` / `avgHandlerDurationMs`。

### `bus.destroy()`

销毁实例并释放 adapter 资源。

### API 使用片段

```ts
// 分组取消
bus.offGroup('auth')

// 标签取消
bus.unsubscribeByTag('critical')

// 暂停 / 恢复
bus.pause('order.**')
bus.resume('order.**')

// 运行时信息
const names = bus.eventNames()
const count = bus.listenerCount()
const replay = bus.replayFor('order.created')
const snapshot = bus.metrics()

// 释放资源
await bus.destroy()
```

## 配置表

### `EventBusOptions`

| 选项 | 类型 | 默认值 | 说明 | since | 是否弃用 | 替代项 |
|---|---|---|---|---|---|---|
| `debug` | `boolean` | `false` | 是否输出调试日志 | `1.0.0` | 否 | `-` |
| `middleware` | `Middleware[]` | `[]` | 中间件管线，按注册顺序执行 | `1.0.0` | 否 | `-` |
| `replay` | `ReplayPolicy` | `undefined` | replay 缓存策略 | `1.0.0` | 否 | `-` |
| `sticky` | `StickyPolicy` | `undefined` | sticky 缓存策略 | `1.0.0` | 否 | `-` |
| `adapters` | `EventAdapter[]` | `[InMemoryAdapter]` | 传输适配器列表 | `1.0.0` | 否 | `-` |
| `reporter` | `MetricsReporter` | `undefined` | 指标回调 | `1.0.0` | 否 | `-` |

`ReplayPolicy`：

| 字段 | 类型 | 默认值 | 说明 | since | 是否弃用 | 替代项 |
|---|---|---|---|---|---|---|
| `count` | `number` | `undefined` | 每个事件最多保留的历史条数 | `1.0.0` | 否 | `-` |
| `ttlMs` | `number` | `undefined` | replay 条目生存时间（毫秒） | `1.0.0` | 否 | `-` |

`StickyPolicy`：

| 字段 | 类型 | 默认值 | 说明 | since | 是否弃用 | 替代项 |
|---|---|---|---|---|---|---|
| `enabled` | `boolean` | `false` | 是否启用 sticky（只保留最后一条） | `1.0.0` | 否 | `-` |

### `SubscriptionOptions`

| 选项 | 类型 | 默认值 | 说明 | since | 是否弃用 | 替代项 |
|---|---|---|---|---|---|---|
| `once` | `boolean` | `false` | 触发一次后自动移除 | `1.0.0` | 否 | `-` |
| `priority` | `number` | `0` | 优先级（越大越先执行） | `1.0.0` | 否 | `-` |
| `paused` | `boolean` | `false` | 初始是否暂停 | `1.0.0` | 否 | `-` |
| `timeoutMs` | `number` | `undefined` | 单监听器超时（毫秒） | `1.0.0` | 否 | `-` |
| `retry` | `number \| RetryConfig` | `undefined` | 重试策略 | `1.0.0` | 否 | `-` |
| `concurrency` | `number` | `undefined` | 单监听器并发限制 | `1.0.0` | 否 | `-` |
| `group` | `string` | `undefined` | 分组名（配合 `offGroup`） | `1.0.0` | 否 | `-` |
| `tags` | `string[]` | `undefined` | 标签列表（配合 `unsubscribeByTag`） | `1.0.0` | 否 | `-` |
| `replay` | `boolean` | `false` | 订阅时是否立即回放历史/粘性事件 | `1.0.0` | 否 | `-` |

`RetryConfig`：

| 字段 | 类型 | 默认值 | 说明 | since | 是否弃用 | 替代项 |
|---|---|---|---|---|---|---|
| `times` | `number` | `0`（未设置 `profile` 时） | 最大重试次数 | `1.0.0` | 否 | `-` |
| `delayMs` | `number` | `0` | 首次重试延迟（毫秒） | `1.0.0` | 否 | `-` |
| `backoff` | `'fixed' \| 'linear' \| 'exponential'` | `'fixed'` | 退避策略 | `1.0.0` | 否 | `-` |
| `jitterMs` | `number` | `0` | 重试抖动上限（在基础延迟上增加随机抖动） | `+1.0.0` | 否 | `-` |
| `profile` | `'aggressive' \| 'balanced' \| 'conservative'` | `undefined` | 快速应用重试预设（可被显式字段覆盖） | `+1.0.0` | 否 | `-` |
| `shouldRetry` | `(error, attempt) => boolean \| Promise<boolean>` | `undefined` | 动态决定是否继续重试 | `+1.0.0` | 否 | `-` |

### `EmitOptions`

| 选项 | 类型 | 默认值 | 说明 | since | 是否弃用 | 替代项 |
|---|---|---|---|---|---|---|
| `signal` | `AbortSignal` | `undefined` | 中断本次发射 | `1.0.0` | 否 | `-` |
| `timeoutMs` | `number` | `undefined` | 监听器超时默认值（当监听器未单独设置 `SubscriptionOptions.timeoutMs` 时生效） | `1.0.0` | 否 | `-` |
| `collect` | `CollectStrategy` | `{ kind: 'array' }` | `emitCollect` 聚合策略 | `1.0.0` | 否 | `-` |
| `trace` | `TraceContext` | `undefined` | 链路追踪信息 | `1.0.0` | 否 | `-` |
| `meta` | `Omit<EventMeta, 'timestamp'>` | `undefined` | 附加元信息（`timestamp` 自动注入） | `1.0.0` | 否 | `-` |

`CollectStrategy`：

| 选项 | 说明 | since | 是否弃用 | 替代项 |
|---|---|---|---|---|
| `{ kind: 'array' }` | 返回所有监听器结果数组 | `1.0.0` | 否 | `-` |
| `{ kind: 'first' }` | 返回首个结果 | `1.0.0` | 否 | `-` |
| `{ kind: 'race' }` | 返回最快结果 | `1.0.0` | 否 | `-` |
| `{ kind: 'reduce', initial, reducer }` | 通过 reducer 聚合结果 | `1.0.0` | 否 | `-` |

## 导出一览

### 核心 API

- `createEventBus`
- `EventBus`

### 适配器

- `InMemoryAdapter`
- `BroadcastChannelAdapter`
- `WebWorkerAdapter`
- `NodeWorkerThreadsAdapter`

### 工具函数

- `isPatternMatch`
- `patternToRegExp`
- `isRetriableNetworkError`

### 类型导出

- `EventMap`、`EventBusOptions`、`EventBusInstance`
- `SubscriptionOptions`、`EmitOptions`
- `CollectStrategy`、`CollectResult`
- `EventAdapter`、`MetricsSnapshot`、`MetricsReporter`
- 以及 `src/types.ts` 中的全部公开类型

### 导入示例

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

## 示例

```bash
pnpm run build
pnpm run examples
```

打开 `http://localhost:3000` 查看：

| 示例 | 场景 | 覆盖能力 |
|---|---|---|
| `basic` | 基础发布/订阅 | `on` / `emit` 基本用法 |
| `pattern-matching` | 模式匹配 | 精确事件 + `*` / `**` |
| `pattern-utils` | 工具函数 | `isPatternMatch` / `patternToRegExp` |
| `emit-collect` | 聚合结果 | `array` / `first` / `race` / `reduce` |
| `replay-sticky` | 历史回放 | replay + sticky |
| `policies` | 执行策略 | timeout / retry / cancel / concurrency / shouldRetry / profile |
| `adapters-browser` | 浏览器多实例通信 | InMemory + BroadcastChannel + WebWorker |
| `adapters-node-worker` | Node 多线程通信 | worker_threads 适配器交互验证 + Node 脚本执行 |
| `observability` | 可观测性 | middleware + metrics + trace/reporter |
| `async` | 异步监听器 | Promise 处理链路 |
| `error` | 异常处理 | 监听器异常与容错行为 |
| `priority-context` | 优先级与上下文 | priority + handler context |
| `namespace` | 事件命名空间 | dot 风格事件组织 |
| `lifecycle` | 生命周期管理 | pause / resume / destroy |
| `introspection` | 运行时检查 | eventNames / listenerCount / replayFor / metrics |

### 覆盖矩阵（场景 × API × 示例 × 测试）

| 场景 | API | 示例 | 测试 |
|---|---|---|---|
| 基础订阅发布 | `on` / `emit` / `once` | `basic` | `tests/event-bus.test.ts` |
| 模式订阅与匹配 | `onPattern` / `isPatternMatch` / `patternToRegExp` | `pattern-matching` + `pattern-utils` | `tests/event-bus.test.ts` + `tests/pattern-matcher.test.ts` |
| 聚合策略 | `emitCollect` (`array/first/race/reduce`) | `emit-collect` | `tests/event-bus.test.ts` |
| 历史与粘性事件 | `replay` / `sticky` / `replayFor` | `replay-sticky` | `tests/event-bus.test.ts` |
| 执行控制 | `timeoutMs` / `retry` / `concurrency` / `signal` | `policies` | `tests/event-bus.test.ts` + `tests/policies.test.ts` |
| 生命周期管理 | `pause` / `resume` / `offGroup` / `unsubscribeByTag` / `destroy` | `lifecycle` | `tests/event-bus.test.ts` |
| 运行时观测 | `eventNames` / `listenerCount` / `metrics` | `introspection` | `tests/event-bus.test.ts` |
| 可观测扩展 | `middleware` / `reporter` / `trace` / `meta` | `observability` | `tests/event-bus.test.ts` |
| 跨运行时适配 | `InMemoryAdapter` / `BroadcastChannelAdapter` / `WebWorkerAdapter` / `NodeWorkerThreadsAdapter` | `adapters-browser` + `adapters-node-worker` | `tests/adapters.test.ts` |

## 项目结构

| 路径 | 作用 | 是否对使用者公开 |
|---|---|---|
| `src/index.ts` | 包入口，统一导出 API 与类型 | 是（npm 导出入口） |
| `src/core.ts` | EventBus 主实现（订阅/发射/聚合/生命周期） | 否（内部实现） |
| `src/types.ts` | 全量类型定义（Options/Context/Adapter/Metrics） | 是（类型导出） |
| `src/matcher.ts` | pattern 匹配与正则转换工具 | 是（导出工具函数） |
| `src/store.ts` | 监听器存储与匹配 | 否（内部实现） |
| `src/policy.ts` | timeout/retry/concurrency 等执行策略 | 否（内部实现） |
| `src/replay-sticky.ts` | replay/sticky 缓存能力 | 否（内部实现） |
| `src/reporter.ts` | 指标聚合与 reporter 调用 | 否（内部实现） |
| `src/adapters/` | 跨运行时适配器实现 | 是（适配器类导出） |
| `tests/` | 单元测试（核心、匹配器、策略、适配器） | 否 |
| `examples/` | 可交互示例（浏览器 + worker 场景） | 否（文档与演示） |
| `dist/` | 构建产物（发布内容） | 是（发布产物） |
| `README.md` / `README.en.md` | 中文/英文文档 | 是 |

## FAQ / 常见问题

### 1）`*` 和 `**` 有什么区别？

- `*`：匹配单段，例如 `order.*` 匹配 `order.created`，不匹配 `order.pay.success`
- `**`：匹配多段，例如 `order.**` 可匹配 `order.created`、`order.pay.success`

### 2）什么时候用 `emit`，什么时候用 `emitCollect`？

- 用 `emit`：只关心是否有监听器命中（返回 `boolean`）
- 用 `emitCollect`：需要拿到监听器返回值，并按 `array/first/race/reduce` 聚合

### 3）什么时候开启 replay / sticky？

- `replay`：新订阅者需要补历史事件时开启（事件溯源场景）
- `sticky`：新订阅者只需要最近一次状态时开启（状态同步场景）
- 两者可同时使用：优先 sticky 最近值，再结合 replay 历史

### 4）如何选择适配器？

- 单进程内：默认 `InMemoryAdapter` 即可
- 浏览器多标签页：`BroadcastChannelAdapter`
- 浏览器 Worker 通信：`WebWorkerAdapter`
- Node 多线程：`NodeWorkerThreadsAdapter`

### 5）如何控制监听器执行可靠性？

- 用 `timeoutMs` 限制单监听器最大执行时长
- 用 `retry` 设置失败重试（固定/线性/指数退避）
- 用 `profile` 快速应用重试预设，再按需覆盖单个字段
- 用 `jitterMs` 打散重试时间，降低突发并发重试导致的雪崩风险
- 用 `shouldRetry(error, attempt)` 按错误类型动态中止无意义重试
- 可结合 `isRetriableNetworkError(error)` 复用网络错误重试判断逻辑
- 用 `concurrency` 限制单监听器并发度，防止被突发事件压垮

### 6）如何做运行时排查？

- `eventNames()`：查看当前注册模式
- `listenerCount(pattern?)`：核对监听器数量
- `replayFor(event)`：检查回放缓存
- `metrics()`：查看 emit/handled/failed/dropped 与平均耗时

## 开发命令

```bash
pnpm run lint
pnpm run typecheck
pnpm run test:run
pnpm run test:coverage
pnpm run build
pnpm run test:node:smoke
pnpm run examples
```

## 技术栈

- 构建：Vite + vite-plugin-dts
- 测试：Vitest + @vitest/coverage-v8
- 规范：Biome + Commitlint + Husky
- 发布：Changesets + GitHub Actions

## License

[MIT](./LICENSE)
