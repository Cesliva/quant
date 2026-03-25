/**
 * Labor Rates Types and Helpers
 *
 * Supports true estimating shop rates with two modes:
 * - Manual: Direct shop rate entry
 * - Calculated: Labor + Directs + Indirects
 *   - Labor (base wage $/hr)
 *   - Directs (burden: benefits, payroll taxes $/hr)
 *   - Indirects (consumables, overhead, equipment $/hr)
 *
 * Project-level overrides can store:
 * - originalCompanyRate
 * - overriddenProjectRate
 * - overrideReason
 * - overriddenBy
 * - overrideTimestamp
 */

export type LaborRateMode = "manual" | "calculated";

/** Persisted company-level labor rate (Firestore) */
export interface LaborRateStored {
  trade: string;
  /** Effective shop rate used in estimates. Always present for backward compatibility. */
  rate: number;
  rateMode?: LaborRateMode;
  /** Labor: base wage $/hr */
  baseWage?: number;
  /** Directs: burden $/hr (benefits, payroll taxes). Legacy: burdenPercent converted on load. */
  burdenDollars?: number;
  /** @deprecated Use burdenDollars. Migrated on load: burdenDollars = baseWage * (burdenPercent/100) */
  burdenPercent?: number;
  /** Indirects: consumables, overhead, equipment allocation $/hr */
  indirectsDollars?: number;
  shopRate?: number;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** UI state with transient id for list management */
export interface LaborRateWithId extends LaborRateStored {
  id: string;
}

/** Future: Project-level override audit fields */
export interface LaborRateOverrideAudit {
  originalCompanyRate: number;
  overriddenProjectRate: number;
  overrideReason?: string;
  overriddenBy?: string;
  overrideTimestamp?: string;
}

/** Max $/hr for validation */
export const BURDEN_DOLLARS_CAP = 500;
export const INDIRECTS_DOLLARS_CAP = 500;

/** Shop rate formula: Labor + Directs + Indirects */
export function calculateShopRate(
  baseWage: number,
  burdenDollars: number,
  indirectsDollars: number = 0
): number {
  return baseWage + burdenDollars + indirectsDollars;
}

/** Migrate legacy burdenPercent to burdenDollars when loading */
export function getBurdenDollars(r: LaborRateStored): number {
  if (r.burdenDollars != null) return r.burdenDollars;
  if (r.burdenPercent != null && r.baseWage != null) {
    return r.baseWage * (r.burdenPercent / 100);
  }
  return 0;
}

/** Resolve effective shop rate from a stored rate (handles legacy and new shape) */
export function getEffectiveShopRate(r: LaborRateStored): number {
  if (r.rateMode === "calculated" && r.baseWage != null) {
    const burdenDollars = getBurdenDollars(r);
    const indirectsDollars = r.indirectsDollars ?? 0;
    return calculateShopRate(r.baseWage, burdenDollars, indirectsDollars);
  }
  return r.shopRate ?? r.rate;
}
