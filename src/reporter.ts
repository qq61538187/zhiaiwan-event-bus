import type { MetricsReporter, MetricsSnapshot } from './types'

export class MetricsState {
  private emitCount = 0
  private handledCount = 0
  private failedCount = 0
  private droppedCount = 0
  private totalDurationMs = 0

  constructor(private readonly reporter?: MetricsReporter) {}

  onEmit(event: string): void {
    this.emitCount += 1
    this.reporter?.onEmit?.(event)
  }

  onHandled(event: string, durationMs: number): void {
    this.handledCount += 1
    this.totalDurationMs += durationMs
    this.reporter?.onHandled?.(event, durationMs)
  }

  onError(event: string, error: unknown): void {
    this.failedCount += 1
    this.reporter?.onError?.(event, error)
  }

  onDropped(): void {
    this.droppedCount += 1
  }

  snapshot(): MetricsSnapshot {
    return {
      emitCount: this.emitCount,
      handledCount: this.handledCount,
      failedCount: this.failedCount,
      droppedCount: this.droppedCount,
      avgHandlerDurationMs:
        this.handledCount === 0 ? 0 : Number((this.totalDurationMs / this.handledCount).toFixed(2)),
    }
  }
}
