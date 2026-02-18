"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { useUserPermissions } from "@/lib/hooks/useUserPermissions";
import { getDocument, updateDocument } from "@/lib/firebase/firestore";
import { type Subscription, type SubscriptionPlan, PLAN_LIMITS } from "@/lib/utils/subscription";
import { Crown, Check, X, AlertCircle, Info } from "lucide-react";
import { isFirebaseConfigured } from "@/lib/firebase/config";

export default function SubscriptionManagement() {
  const companyId = useCompanyId();
  const { subscription, currentSeats, maxSeats, remainingSeats, loading } = useSubscription();
  const { permissions } = useUserPermissions();
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);

  const canManageSubscription = permissions.canManageUsers; // Only admins can manage subscription

  const plans: SubscriptionPlan[] = ["solo", "team", "professional", "enterprise"];

  const planNames: Record<SubscriptionPlan, string> = {
    solo: "Solo",
    team: "Team",
    professional: "Professional",
    enterprise: "Enterprise",
  };

  const planDescriptions: Record<SubscriptionPlan, string> = {
    solo: "Perfect for individual estimators",
    team: "Ideal for small teams",
    professional: "For growing companies",
    enterprise: "For large organizations",
  };

  const handleUpdateSubscription = async (newPlan: SubscriptionPlan) => {
    if (!canManageSubscription || !isFirebaseConfigured() || !companyId) {
      return;
    }

    setIsUpdating(true);
    try {
      const newSubscription: Subscription = {
        ...subscription,
        plan: newPlan,
        maxSeats: PLAN_LIMITS[newPlan].maxSeats,
      };

      await updateDocument(`companies`, companyId, {
        subscription: newSubscription,
      });

      alert(`Subscription updated to ${planNames[newPlan]} plan successfully!`);
      setSelectedPlan(null);
    } catch (error: any) {
      console.error("Failed to update subscription:", error);
      alert(`Failed to update subscription: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-gray-500">Loading subscription information...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Subscription */}
      <Card>
        <CardHeader className="pb-4 pt-5 mb-4 border-b border-gray-200/70">
          <CardTitle className="flex items-center gap-2 font-extrabold text-gray-900 tracking-normal">
            <Crown className="w-5 h-5 text-yellow-500" />
            Current Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <div>
              <h3 className="text-lg font-bold text-gray-900 tracking-normal">
                {planNames[subscription.plan]} Plan
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {planDescriptions[subscription.plan]}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">
                {currentSeats} / {maxSeats}
              </div>
              <div className="text-sm text-gray-500">seats used</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Status:</span>
              <span className={`ml-2 font-medium ${
                subscription.status === "active" ? "text-green-600" : "text-red-600"
              }`}>
                {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Remaining seats:</span>
              <span className={`ml-2 font-medium ${
                remainingSeats === 0 ? "text-red-600" : remainingSeats <= 2 ? "text-yellow-600" : "text-gray-900"
              }`}>
                {remainingSeats}
              </span>
            </div>
          </div>

          {remainingSeats === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">Seat limit reached</p>
                <p className="text-sm text-yellow-700 mt-1">
                  You've reached your seat limit. Upgrade your plan to invite more users.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan Management (Admin Only) */}
      {canManageSubscription && (
        <Card>
          <CardHeader className="pb-4 pt-5 mb-4 border-b border-gray-200/70">
            <CardTitle className="font-extrabold text-gray-900 tracking-normal">Manage Subscription</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Update your subscription plan. Changes take effect immediately.
            </p>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Manual Subscription Management</p>
                  <p>
                    This is a manual subscription system. To change plans, select a new plan below.
                    For production, integrate with a payment provider like Stripe for automatic billing.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map((plan) => {
                const limits = PLAN_LIMITS[plan];
                const isCurrentPlan = subscription.plan === plan;
                const isSelected = selectedPlan === plan;

                return (
                  <div
                    key={plan}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      isCurrentPlan
                        ? "border-blue-500 bg-blue-50"
                        : isSelected
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => !isCurrentPlan && setSelectedPlan(plan)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-gray-900 tracking-normal">{planNames[plan]}</h3>
                      {isCurrentPlan && (
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mb-3">{planDescriptions[plan]}</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">Seats:</span>
                        <span className="font-medium">
                          {limits.maxSeats === 999 ? "Unlimited" : limits.maxSeats}
                        </span>
                      </div>
                      <div className="space-y-1 mt-3">
                        <div className="flex items-center gap-1 text-xs">
                          {limits.features.advancedAnalytics ? (
                            <Check className="w-3 h-3 text-green-600" />
                          ) : (
                            <X className="w-3 h-3 text-gray-400" />
                          )}
                          <span className={limits.features.advancedAnalytics ? "text-gray-700" : "text-gray-400"}>
                            Advanced Analytics
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          {limits.features.apiAccess ? (
                            <Check className="w-3 h-3 text-green-600" />
                          ) : (
                            <X className="w-3 h-3 text-gray-400" />
                          )}
                          <span className={limits.features.apiAccess ? "text-gray-700" : "text-gray-400"}>
                            API Access
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          {limits.features.prioritySupport ? (
                            <Check className="w-3 h-3 text-green-600" />
                          ) : (
                            <X className="w-3 h-3 text-gray-400" />
                          )}
                          <span className={limits.features.prioritySupport ? "text-gray-700" : "text-gray-400"}>
                            Priority Support
                          </span>
                        </div>
                        {limits.features.dedicatedSupport && (
                          <div className="flex items-center gap-1 text-xs">
                            <Check className="w-3 h-3 text-green-600" />
                            <span className="text-gray-700">Dedicated Support</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {isSelected && !isCurrentPlan && (
                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full mt-4"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateSubscription(plan);
                        }}
                        disabled={isUpdating}
                      >
                        {isUpdating ? "Updating..." : "Select Plan"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {!canManageSubscription && (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-gray-500">
              Only administrators can manage subscription settings.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

