import { describe, expect, it } from 'vitest'
import { isPatternMatch, patternToRegExp } from '../src'

describe('pattern matcher', () => {
  it('matches exact event names', () => {
    expect(isPatternMatch('user.login', 'user.login')).toBe(true)
    expect(isPatternMatch('user.login', 'user.logout')).toBe(false)
  })

  it('matches one-level wildcard with *', () => {
    expect(isPatternMatch('user.*', 'user.login')).toBe(true)
    expect(isPatternMatch('user.*', 'user.profile.update')).toBe(false)
  })

  it('matches multi-level wildcard with **', () => {
    expect(isPatternMatch('user.**', 'user.login')).toBe(true)
    expect(isPatternMatch('user.**', 'user.profile.update')).toBe(true)
    expect(isPatternMatch('order.**', 'user.profile.update')).toBe(false)
  })

  it('escapes regex-sensitive literal segments', () => {
    expect(isPatternMatch('user.login+meta', 'user.login+meta')).toBe(true)
    expect(isPatternMatch('user.login+meta', 'user.loginnmeta')).toBe(false)
  })

  it('exposes usable regexp conversion', () => {
    const re = patternToRegExp('order.*.created')
    expect(re.test('order.web.created')).toBe(true)
    expect(re.test('order.web.mobile.created')).toBe(false)
  })

  it('reuses cached regexp for same pattern', () => {
    const first = patternToRegExp('user.*')
    const second = patternToRegExp('user.*')
    expect(first).toBe(second)
  })

  it('evicts old cache entries when cache limit exceeded', () => {
    const first = patternToRegExp('cache.0.*')
    for (let i = 1; i <= 520; i += 1) {
      patternToRegExp(`cache.${i}.*`)
    }
    const again = patternToRegExp('cache.0.*')
    expect(again).not.toBe(first)
  })
})
