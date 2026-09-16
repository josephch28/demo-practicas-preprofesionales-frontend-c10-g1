import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('resolves conflicting tailwind classes, keeping the last one', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('drops falsy values and keeps the rest', () => {
    const hidden: string | undefined = undefined
    expect(cn('a', hidden, null, 'c')).toBe('a c')
  })
})
