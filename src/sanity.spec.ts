import { describe, expect, it } from 'vitest'

describe('tooling', () => {
  it('runs vitest with jsdom and fake-indexeddb', () => {
    expect(typeof indexedDB).toBe('object')
  })
})
