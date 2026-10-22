import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('resolves conflicting tailwind classes, keeping the last one', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('no confunde un tamaño de texto propio (text-14) con un color de texto', () => {
    expect(cn('bg-stamp text-surface', 'h-control px-4 text-14')).toBe('bg-stamp text-surface h-control px-4 text-14')
  })

  it('sigue resolviendo conflictos entre tamaños de texto y alturas propias', () => {
    expect(cn('text-14', 'text-15')).toBe('text-15')
    expect(cn('h-control', 'h-12')).toBe('h-12')
  })

  it('drops falsy values and keeps the rest', () => {
    const hidden: string | undefined = undefined
    expect(cn('a', hidden, null, 'c')).toBe('a c')
  })
})
