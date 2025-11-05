import { calculateWhisperCost, calculateGPT4Cost } from '../usageTracker'

describe('AI Cost Calculation', () => {
  describe('calculateWhisperCost', () => {
    it('calculates cost correctly for minutes', () => {
      expect(calculateWhisperCost(1)).toBe(0.006)
      expect(calculateWhisperCost(5)).toBe(0.03)
      expect(calculateWhisperCost(10)).toBe(0.06)
    })

    it('handles zero minutes', () => {
      expect(calculateWhisperCost(0)).toBe(0)
    })

    it('handles decimal minutes', () => {
      expect(calculateWhisperCost(0.5)).toBe(0.003)
    })
  })

  describe('calculateGPT4Cost', () => {
    it('calculates approximate cost for tokens', () => {
      const cost = calculateGPT4Cost(1000, 'gpt-4o-mini')
      expect(cost).toBeGreaterThan(0)
      expect(cost).toBeLessThan(1) // Should be reasonable
    })

    it('handles zero tokens', () => {
      expect(calculateGPT4Cost(0)).toBe(0)
    })

    it('handles large token counts', () => {
      const cost = calculateGPT4Cost(10000)
      expect(cost).toBeGreaterThan(0)
    })
  })
})

