/**
 * Subscription Management Utility
 * Handles subscription plans, limits, and feature flags
 */

import { getDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";

export type SubscriptionPlan = "solo" | "team" | "professional" | "enterprise";
export type SubscriptionStatus = "active" | "trial" | "expired" | "cancelled";

export interface Subscription {
  plan: SubscriptionPlan;
  maxSeats: number;
  status: SubscriptionStatus;
  currentPeriodEnd?: Date | string;
  createdAt?: Date | string;
  // For future payment integration
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export interface PlanLimits {
  maxSeats: number;
  maxProjects?: number; // undefined = unlimited
  features: {
    advancedAnalytics: boolean;
    apiAccess: boolean;
    customIntegrations: boolean;
    prioritySupport: boolean;
    dedicatedSupport: boolean;
  };
}

// Plan definitions
export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  solo: {
    maxSeats: 1,
    maxProjects: undefined, // unlimited
    features: {
      advancedAnalytics: false,
      apiAccess: false,
      customIntegrations: false,
      prioritySupport: false,
      dedicatedSupport: false,
    },
  },
  team: {
    maxSeats: 5,
    maxProjects: undefined, // unlimited
    features: {
      advancedAnalytics: true,
      apiAccess: false,
      customIntegrations: false,
      prioritySupport: true,
      dedicatedSupport: false,
    },
  },
  professional: {
    maxSeats: 15,
    maxProjects: undefined, // unlimited
    features: {
      advancedAnalytics: true,
      apiAccess: true,
      customIntegrations: false,
      prioritySupport: true,
      dedicatedSupport: false,
    },
  },
  enterprise: {
    maxSeats: 999, // effectively unlimited
    maxProjects: undefined, // unlimited
    features: {
      advancedAnalytics: true,
      apiAccess: true,
      customIntegrations: true,
      prioritySupport: true,
      dedicatedSupport: true,
    },
  },
};

// Default subscription (for new companies)
export const DEFAULT_SUBSCRIPTION: Subscription = {
  plan: "solo",
  maxSeats: 1,
  status: "active",
};

/**
 * Get subscription for a company
 */
export async function getSubscription(companyId: string): Promise<Subscription> {
  if (!isFirebaseConfigured()) {
    return DEFAULT_SUBSCRIPTION;
  }

  try {
    const company = await getDocument<{ subscription?: Subscription }>(
      `companies/${companyId}`
    );

    if (company?.subscription) {
      return {
        ...DEFAULT_SUBSCRIPTION,
        ...company.subscription,
      };
    }
  } catch (error) {
    console.warn("Failed to load subscription, using default:", error);
  }

  return DEFAULT_SUBSCRIPTION;
}

/**
 * Get plan limits for a subscription plan
 */
export function getPlanLimits(plan: SubscriptionPlan): PlanLimits {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.solo;
}

/**
 * Check if subscription is active
 */
export function isSubscriptionActive(subscription: Subscription): boolean {
  return subscription.status === "active" || subscription.status === "trial";
}

/**
 * Check if a feature is available for a plan
 */
export function hasFeature(
  plan: SubscriptionPlan,
  feature: keyof PlanLimits["features"]
): boolean {
  const limits = getPlanLimits(plan);
  return limits.features[feature] || false;
}

/**
 * Get current seat count for a company
 */
export async function getCurrentSeatCount(companyId: string): Promise<number> {
  if (!isFirebaseConfigured()) {
    return 0;
  }

  try {
    const { collection, getDocs } = await import("firebase/firestore");
    const { db } = await import("@/lib/firebase/config");

    if (!db) return 0;

    const membersRef = collection(db, `companies/${companyId}/members`);
    const membersSnapshot = await getDocs(membersRef);
    return membersSnapshot.size;
  } catch (error) {
    console.warn("Failed to get seat count:", error);
    return 0;
  }
}

/**
 * Check if company can add more seats
 */
export async function canAddSeat(companyId: string): Promise<{
  canAdd: boolean;
  currentSeats: number;
  maxSeats: number;
  remainingSeats: number;
}> {
  const subscription = await getSubscription(companyId);
  const currentSeats = await getCurrentSeatCount(companyId);
  const maxSeats = subscription.maxSeats;
  const remainingSeats = Math.max(0, maxSeats - currentSeats);
  const canAdd = currentSeats < maxSeats && isSubscriptionActive(subscription);

  return {
    canAdd,
    currentSeats,
    maxSeats,
    remainingSeats,
  };
}

