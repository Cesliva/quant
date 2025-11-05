import { cn } from '../cn'

describe('cn utility function', () => {
  it('merges class names correctly', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2')
  })

  it('handles conditional classes', () => {
    expect(cn('base', true && 'conditional')).toBe('base conditional')
    expect(cn('base', false && 'conditional')).toBe('base')
  })

  it('handles undefined and null', () => {
    expect(cn('base', undefined, null, 'other')).toBe('base other')
  })

  it('merges Tailwind classes correctly', () => {
    // Tailwind merge should handle conflicting classes
    const result = cn('px-4', 'px-2')
    expect(result).toBe('px-2') // Last one wins with tailwind-merge
  })

  it('handles empty strings', () => {
    expect(cn('base', '', 'other')).toBe('base other')
  })
})

