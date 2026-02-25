---
"@zhiaiwan/event-bus": minor
---

完善 EventBus 运行时可靠性与重试策略。

- 新增 retry 能力：`jitterMs`、`shouldRetry`、`profile`
- 新增工具函数：`isRetriableNetworkError`
- 修复并增强：`replay + sticky` 回放语义、`onPattern` replay、生命周期状态保护、adapter envelope 校验
- 补齐 tests/examples，更新中英文 README 与配置项版本说明
