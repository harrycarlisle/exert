import { describe, expect, it } from 'vitest'
import { TapDebouncer } from './debounce'

describe('tap debounce', () => {
  it('blocks duplicate physical taps but allows intentional rapid separate types', () => {
    const debouncer = new TapDebouncer(350)
    expect(debouncer.shouldAccept('pee', 1000)).toBe(true)
    expect(debouncer.shouldAccept('pee', 1100)).toBe(false)
    expect(debouncer.shouldAccept('poo', 1100)).toBe(true)
    expect(debouncer.shouldAccept('pee', 1400)).toBe(true)
  })
})
