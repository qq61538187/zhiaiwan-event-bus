# @zhiaiwan/event-bus examples

运行示例：

```bash
pnpm build
pnpm examples
```

然后打开 [http://localhost:3000](http://localhost:3000)

## 示例列表

| 示例 | 功能 |
|---|---|
| [basic](./basic/) | 基础发布订阅：`on` / `onPattern` / `once`（订阅选项） |
| [pattern-matching](./pattern-matching/) | 精确事件 + `*` / `**` 模式匹配 |
| [pattern-utils](./pattern-utils/) | 工具函数：`isPatternMatch` / `patternToRegExp` |
| [emit-collect](./emit-collect/) | `emitCollect` 聚合策略（array/first/race/reduce） |
| [replay-sticky](./replay-sticky/) | replay 与 sticky 事件回放 |
| [policies](./policies/) | timeout/retry/cancel/concurrency 策略 |
| [adapters-browser](./adapters-browser/) | InMemory + BroadcastChannel + WebWorker 适配器 |
| [adapters-node-worker](./adapters-node-worker/) | Node worker_threads 适配器交互验证（调用 Node 脚本） |
| [observability](./observability/) | middleware + metrics + trace/reporter |
| [async](./async/) | 异步监听器执行与 emit 等待行为 |
| [error](./error/) | 监听器异常上报（`reporter.onError`） |
| [priority-context](./priority-context/) | 监听器优先级与 HandlerContext 信息 |
| [namespace](./namespace/) | dot 风格事件命名空间组织 |
| [lifecycle](./lifecycle/) | pause/resume/offGroup/unsubscribeByTag/destroy |
| [introspection](./introspection/) | eventNames/listenerCount/replayFor/metrics 运行时观测 |
