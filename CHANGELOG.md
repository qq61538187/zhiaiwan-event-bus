# @zhiaiwan/event-bus

## 1.1.0

### Minor Changes

- 1410357: 完善 EventBus 运行时可靠性与重试策略。

  - 新增 retry 能力：`jitterMs`、`shouldRetry`、`profile`
  - 新增工具函数：`isRetriableNetworkError`
  - 修复并增强：`replay + sticky` 回放语义、`onPattern` replay、生命周期状态保护、adapter envelope 校验
  - 补齐 tests/examples，更新中英文 README 与配置项版本说明

## 1.0.0

### Major Changes

- 1ed7a6b: Initial stable release of @zhiaiwan/event-bus with type-safe event APIs, pattern subscriptions, collect strategies, replay/sticky support, execution policies, cross-runtime adapters, and interactive examples with full test coverage.
- 29125ab: chore: add changeset
