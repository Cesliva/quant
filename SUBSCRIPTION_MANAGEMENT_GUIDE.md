# Subscription Management Guide

## Overview

The subscription system allows you to manage user seat limits based on subscription plans. This is a **manual subscription management system** (Option 1) - perfect for getting started before integrating payment processing.

## Subscription Plans

### Available Plans

1. **Solo** - 1 seat
   - Basic features
   - Perfect for individual estimators

2. **Team** - 5 seats
   - Advanced analytics
   - Priority support
   - Ideal for small teams

3. **Professional** - 15 seats
   - Advanced analytics
   - API access
   - Priority support
   - For growing companies

4. **Enterprise** - 999 seats (effectively unlimited)
   - All features
   - Custom integrations
   - Dedicated support
   - For large organizations

## How It Works

### 1. Setting Up a Subscription (Manual)

To set a company's subscription plan, you need to update the company document in Firestore:

**Firebase Console Method:**
1. Go to Firebase Console → Firestore Database
2. Navigate to `companies/{companyId}`
3. Add or update the `subscription` field:

```json
{
  "subscription": {
    "plan": "team",
    "maxSeats": 5,
    "status": "active",
    "currentPeriodEnd": null
  }
}
```

**Available Plans:**
- `"solo"` - 1 seat
- `"team"` - 5 seats
- `"professional"` - 15 seats
- `"enterprise"` - 999 seats

**Status Options:**
- `"active"` - Subscription is active
- `"trial"` - Trial period
- `"expired"` - Subscription expired
- `"cancelled"` - Subscription cancelled

### 2. Managing Subscriptions via UI

Admins can manage subscriptions through the Settings page:

1. Go to **Settings** → **Subscription** tab
2. View current subscription plan and seat usage
3. Select a new plan to upgrade/downgrade
4. Changes take effect immediately

### 3. Seat Limit Enforcement

The system automatically enforces seat limits:

- **When inviting users**: The API checks if there are available seats before allowing invitations
- **UI indicators**: The users management page shows:
  - Current seat usage (e.g., "3 of 5 seats used")
  - Remaining seats
  - Warning when approaching limit
  - Disabled invite button when at limit

### 4. Default Subscription

New companies automatically get the **Solo** plan (1 seat) if no subscription is set.

## Usage Examples

### Setting a Company to Team Plan (5 seats)

**Via Firebase Console:**
```json
{
  "subscription": {
    "plan": "team",
    "maxSeats": 5,
    "status": "active"
  }
}
```

**Via Code (Admin only):**
```typescript
import { updateDocument } from "@/lib/firebase/firestore";
import { PLAN_LIMITS } from "@/lib/utils/subscription";

await updateDocument("companies", companyId, {
  subscription: {
    plan: "team",
    maxSeats: PLAN_LIMITS.team.maxSeats,
    status: "active",
  },
});
```

### Checking Seat Availability

```typescript
import { canAddSeat } from "@/lib/utils/subscription";

const seatCheck = await canAddSeat(companyId);
if (seatCheck.canAdd) {
  // Can invite user
} else {
  // Seat limit reached
  console.log(`Cannot add seat. ${seatCheck.currentSeats} of ${seatCheck.maxSeats} used.`);
}
```

### Using Subscription Hook in Components

```typescript
import { useSubscription } from "@/lib/hooks/useSubscription";

function MyComponent() {
  const { subscription, currentSeats, maxSeats, canAddSeat } = useSubscription();
  
  return (
    <div>
      <p>Plan: {subscription.plan}</p>
      <p>Seats: {currentSeats} / {maxSeats}</p>
      {!canAddSeat && <p>Seat limit reached!</p>}
    </div>
  );
}
```

## Feature Flags

Each plan has different feature access:

```typescript
import { hasFeature } from "@/lib/utils/subscription";

// Check if plan has a feature
const hasAnalytics = hasFeature("team", "advancedAnalytics"); // true
const hasAPI = hasFeature("team", "apiAccess"); // false
const hasAPIPro = hasFeature("professional", "apiAccess"); // true
```

**Available Features:**
- `advancedAnalytics` - Advanced reporting and analytics
- `apiAccess` - API access for integrations
- `customIntegrations` - Custom integration support
- `prioritySupport` - Priority customer support
- `dedicatedSupport` - Dedicated support representative

## Migration to Payment Integration

When ready to integrate payment processing (e.g., Stripe):

1. **Keep the subscription structure** - It's already compatible
2. **Add payment fields** to subscription:
   ```typescript
   {
     subscription: {
       plan: "team",
       maxSeats: 5,
       status: "active",
       stripeCustomerId: "cus_...",
       stripeSubscriptionId: "sub_...",
       currentPeriodEnd: "2024-12-31T00:00:00Z"
     }
   }
   ```
3. **Update subscription via webhooks** when payment events occur
4. **Remove manual plan selection UI** (or keep for admin override)

## Troubleshooting

### Issue: Seat limit not enforced

**Solution:**
- Check that the company document has a `subscription` field
- Verify `subscription.status` is `"active"` or `"trial"`
- Ensure `subscription.maxSeats` is set correctly

### Issue: Can't invite users even with available seats

**Solution:**
- Check subscription status (must be "active" or "trial")
- Verify member count matches expected seat usage
- Check browser console for errors

### Issue: Subscription not showing in UI

**Solution:**
- Ensure company document exists in Firestore
- Check that `subscription` field is properly formatted
- Verify user has admin permissions

## Next Steps

1. **Set up subscriptions** for existing companies in Firebase Console
2. **Test seat limits** by trying to invite users
3. **Monitor usage** via the Settings → Subscription page
4. **Plan payment integration** when ready for production billing

## Support

For questions or issues with subscription management, check:
- Firebase Console for company/subscription data
- Browser console for errors
- Settings → Subscription page for current status

