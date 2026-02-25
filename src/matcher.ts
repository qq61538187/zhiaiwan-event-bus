import type { Pattern } from './types'

const REGEXP_CACHE_LIMIT = 500
const patternRegExpCache = new Map<string, RegExp>()

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildPatternRegExp(pattern: Pattern): RegExp {
  const parts = pattern.split('.')
  const source = parts
    .map((part) => {
      if (part === '**') return '(?:.+)?'
      if (part === '*') return '[^.]+'
      return escapeRegExp(part)
    })
    .join('\\.')
  return new RegExp(`^${source}$`)
}

export function patternToRegExp(pattern: Pattern): RegExp {
  const cached = patternRegExpCache.get(pattern)
  if (cached) {
    patternRegExpCache.delete(pattern)
    patternRegExpCache.set(pattern, cached)
    return cached
  }

  const created = buildPatternRegExp(pattern)
  patternRegExpCache.set(pattern, created)
  if (patternRegExpCache.size > REGEXP_CACHE_LIMIT) {
    const oldestKey = patternRegExpCache.keys().next().value
    if (oldestKey !== undefined) {
      patternRegExpCache.delete(oldestKey)
    }
  }
  return created
}

export function isPatternMatch(pattern: Pattern, event: string): boolean {
  if (pattern === event) return true
  if (!pattern.includes('*')) return false
  return patternToRegExp(pattern).test(event)
}
