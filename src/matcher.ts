import type { Pattern } from './types'

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function patternToRegExp(pattern: Pattern): RegExp {
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

export function isPatternMatch(pattern: Pattern, event: string): boolean {
  if (pattern === event) return true
  if (!pattern.includes('*')) return false
  return patternToRegExp(pattern).test(event)
}
