import { isPatternMatch } from './matcher'
import type { EventMap, ListenerEntry, Pattern } from './types'

export class ListenerStore<Events extends EventMap> {
  private entries: ListenerEntry<Events>[] = []

  add(entry: ListenerEntry<Events>): void {
    this.entries.push(entry)
    this.entries.sort((a, b) => b.options.priority - a.options.priority)
  }

  remove(id: string): void {
    this.entries = this.entries.filter((entry) => entry.id !== id)
  }

  removeByGroup(group: string): void {
    this.entries = this.entries.filter((entry) => entry.options.group !== group)
  }

  removeByTag(tag: string): void {
    this.entries = this.entries.filter((entry) => !(entry.options.tags ?? []).includes(tag))
  }

  pause(pattern: Pattern): void {
    for (const entry of this.entries) {
      if (entry.pattern === pattern) entry.paused = true
    }
  }

  resume(pattern: Pattern): void {
    for (const entry of this.entries) {
      if (entry.pattern === pattern) entry.paused = false
    }
  }

  match(event: string): ListenerEntry<Events>[] {
    return this.entries.filter((entry) => !entry.paused && isPatternMatch(entry.pattern, event))
  }

  patterns(): string[] {
    return [...new Set(this.entries.map((entry) => entry.pattern))]
  }

  count(pattern?: Pattern): number {
    if (!pattern) return this.entries.length
    return this.entries.filter((entry) => entry.pattern === pattern).length
  }

  clear(): void {
    this.entries = []
  }
}
