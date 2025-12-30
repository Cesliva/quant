# Professional Beta Tester Invitation System

## Overview

This system provides a **professional SaaS-style invitation flow** for beta testers. Instead of sharing codes or serials, you send them a personalized invitation email with a signup link.

## How It Works

### 1. **Send Invitation** (Admin/Owner Only)

1. Go to **Settings → Beta Testers** (or `/settings/beta-testers`)
2. Click **"New Invitation"**
3. Enter:
   - **Email** (required) - The tester's email address
   - **Name** (optional) - Personalizes the email
   - **Company Name** (optional) - Pre-fills their workspace name
4. Click **"Send Invitation"**

The system will:
- Create a unique invitation token
- Send a professional email with a signup link
- Store the invitation in Firestore for tracking

### 2. **Beta Tester Experience**

When a tester receives the email:

1. **Click the invitation link** → Goes to `/beta-signup/{token}`
2. **See pre-filled form** with their email (and optionally name/company)
3. **Fill in remaining details**:
   - Confirm/update name
   - Set company name
   - Create password
4. **Click "Create Account"** → Account created, automatically becomes Workspace Owner
5. **Redirected to dashboard** → Ready to test!

**No codes, no serials, no confusion** - just a clean signup flow.

### 3. **Invitation Management**

In **Settings → Beta Testers**, you can:
- See all invitations sent
- Track status: **Pending**, **Accepted**, or **Expired**
- View when invitations were sent
- Send new invitations

## Key Features

✅ **Professional Email** - Branded invitation email with clear CTA  
✅ **Pre-filled Forms** - Tester's info is pre-populated  
✅ **Automatic Ownership** - First user becomes Workspace Owner  
✅ **No Codes Needed** - Invitation token handles access  
✅ **Status Tracking** - See who accepted, who hasn't  
✅ **14-Day Expiry** - Invitations expire after 14 days (configurable)  
✅ **Admin Only** - Only workspace owners/admins can send invitations  

## Email Configuration

The system uses the same email service as your signup flow:

- **Resend**: Set `EMAIL_SERVICE=resend` and `RESEND_API_KEY`
- **SendGrid**: Set `EMAIL_SERVICE=sendgrid` and `SENDGRID_API_KEY`
- **Console** (Dev): Default, logs to console

## API Endpoint

**POST** `/api/beta-invite`

```json
{
  "email": "tester@example.com",
  "name": "John Doe",
  "companyName": "Steel Co",
  "invitedBy": "user-id",
  "expiresInDays": 14
}
```

Response:
```json
{
  "success": true,
  "invitationToken": "...",
  "inviteLink": "https://yourapp.com/beta-signup/...",
  "emailSent": true,
  "emailError": null
}
```

## Firestore Structure

**Collection**: `betaInvitations`

```typescript
{
  email: string;
  name?: string;
  companyName?: string;
  invitationToken: string;
  status: "pending" | "accepted" | "expired";
  createdAt: Timestamp;
  expiresAt: Timestamp;
  acceptedAt?: Timestamp;
  acceptedBy?: string;
  invitedBy?: string;
}
```

## Comparison: Old vs New

### ❌ Old Way (Codes/Serials)
- Share beta code: "Use code BETA2024"
- Share license serial: "Enter XXXX-XXXX-XXXX-XXXX"
- Tester confused: "Where do I enter this?"
- Manual tracking: "Did they sign up?"

### ✅ New Way (Invitations)
- Send invitation email
- Tester clicks link
- Pre-filled signup form
- Automatic tracking in dashboard

## Migration from Codes

If you're currently using beta codes or license serials:

1. **Keep them for now** - They still work for direct signups
2. **Start using invitations** - For new beta testers
3. **Gradually phase out codes** - As you onboard new testers

The invitation system doesn't replace codes/serials - it's an additional, more professional option.

## Best Practices

1. **Personalize invitations** - Include tester's name when possible
2. **Set company name** - If you know their company, pre-fill it
3. **Follow up** - Check status after a few days if still pending
4. **Resend if expired** - Create new invitation if old one expired
5. **Track engagement** - Use the history to see who's active

## Troubleshooting

**Email not sending?**
- Check `EMAIL_SERVICE` environment variable
- Verify API keys (Resend/SendGrid)
- Check console logs for errors

**Invitation link not working?**
- Check if invitation expired (14 days default)
- Verify token matches Firestore document
- Check if already accepted

**Tester can't sign up?**
- Ensure invitation status is "pending"
- Check expiration date
- Verify email matches invitation







