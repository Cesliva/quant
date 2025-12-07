/**
 * Hook to get subscription information for the current company
 */

import { useState, useEffect } from "react";
import { useCompanyId } from "./useCompanyId";
import {
  getSubscription,
  type Subscription,
  type SubscriptionPlan,
  getPlanLimits,
  type PlanLimits,
  canAddSeat,
  getCurrentSeatCount,
} from "@/lib/utils/subscription";
import { isFirebaseConfigured } from "@/lib/firebase/config";

interface SubscriptionInfo {
  subscription: Subscription;
  limits: PlanLimits;
  currentSeats: number;
  canAddSeat: boolean;
  remainingSeats: number;
  loading: boolean;
}

export function useSubscription(): SubscriptionInfo {
  const companyId = useCompanyId();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [currentSeats, setCurrentSeats] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSubscription = async () => {
      if (!isFirebaseConfigured() || !companyId || companyId === "default") {
        setLoading(false);
        return;
      }

      try {
        const [sub, seats] = await Promise.all([
          getSubscription(companyId),
          getCurrentSeatCount(companyId),
        ]);

        setSubscription(sub);
        setCurrentSeats(seats);
      } catch (error) {
        console.error("Failed to load subscription:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSubscription();
  }, [companyId]);

  if (!subscription) {
    return {
      subscription: {
        plan: "solo",
        maxSeats: 1,
        status: "active",
      },
      limits: getPlanLimits("solo"),
      currentSeats: 0,
      canAddSeat: false,
      remainingSeats: 0,
      loading,
    };
  }

  const limits = getPlanLimits(subscription.plan);
  const remainingSeats = Math.max(0, subscription.maxSeats - currentSeats);
  const canAdd = currentSeats < subscription.maxSeats && subscription.status === "active";

  return {
    subscription,
    limits,
    currentSeats,
    canAddSeat: canAdd,
    remainingSeats,
    loading,
  };
}

/**
 * Hook to check if a specific feature is available
 */
export function useFeature(feature: keyof PlanLimits["features"]): boolean {
  const { subscription } = useSubscription();
  const limits = getPlanLimits(subscription.plan);
  return limits.features[feature] || false;
}

