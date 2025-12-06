# Beta Access Code Management Guide

## Overview

The beta access code system allows you to control who can sign up for Quant Steel Estimating. You can:
- **Require** beta codes for all signups (closed beta)
- **Make codes optional** (open beta with optional codes)
- **Disable** beta requirement entirely (public signup)

## How It Works

### Firebase Structure

Beta access configuration is stored in Firebase at:
```
/betaAccess/config
```

### Configuration Structure

```typescript
{
  enabled: boolean,    // false = codes REQUIRED, true/undefined = codes optional
  codes: string[],     // Array of valid beta access codes
  message?: string     // Custom error message when code is required
}
```

## Setup Options

### Option 1: Using Firebase Console (Recommended)

1. Go to Firebase Console → Firestore Database
2. Create a new collection: `betaAccess`
3. Create a document with ID: `config`
4. Add the following fields:

**For Closed Beta (Require Codes):**
```json
{
  "enabled": false,
  "codes": ["BETA2024", "QUANT2024", "STEEL2024"],
  "message": "Beta access code is required. Contact support@quant.com for access."
}
```

**For Open Beta (Optional Codes):**
```json
{
  "enabled": true,
  "codes": ["BETA2024", "QUANT2024"],
  "message": ""
}
```

**For Public Signup (No Restrictions):**
```json
{
  "enabled": true,
  "codes": [],
  "message": ""
}
```

Or simply **don't create the document** - if it doesn't exist, signups are open to everyone.

### Option 2: Using Code (For Programmatic Management)

You can use the utility functions in `lib/utils/betaAccess.ts`:

```typescript
import { 
  updateBetaAccessConfig, 
  addBetaAccessCode, 
  removeBetaAccessCode,
  setBetaAccessRequired 
} from "@/lib/utils/betaAccess";

// Require beta codes
await updateBetaAccessConfig({
  enabled: false,
  codes: ["BETA2024", "QUANT2024"],
  message: "Beta access code required. Contact support."
});

// Add a new code
await addBetaAccessCode("NEWCODE2024");

// Remove a code
await removeBetaAccessCode("OLDCODE");

// Toggle requirement
await setBetaAccessRequired(true);  // Require codes
await setBetaAccessRequired(false); // Make optional
```

## Common Scenarios

### Scenario 1: Closed Beta - Only Specific Users

1. Set `enabled: false` in Firebase
2. Add your beta codes: `["BETA2024", "QUANT2024"]`
3. Share codes with beta testers
4. Users must enter a valid code to sign up

### Scenario 2: Open Beta - Anyone Can Sign Up

1. Set `enabled: true` in Firebase
2. Optionally add codes for special access: `["VIP2024"]`
3. Users can sign up without a code, or use a code if they have one

### Scenario 3: Public Launch - No Restrictions

1. Delete the `betaAccess/config` document in Firebase, OR
2. Set `enabled: true` with empty `codes: []`

### Scenario 4: Shut Down Beta Access Temporarily

1. Set `enabled: false` in Firebase
2. Remove all codes: `codes: []`
3. Set message: `"Beta signups are currently closed. Please check back soon."`
4. No one can sign up until you re-enable

## Managing Beta Codes

### Adding New Codes

**Firebase Console:**
1. Go to `betaAccess/config`
2. Edit the `codes` array
3. Add new code: `["BETA2024", "NEWCODE2024"]`

**Code:**
```typescript
await addBetaAccessCode("NEWCODE2024");
```

### Removing Codes

**Firebase Console:**
1. Go to `betaAccess/config`
2. Edit the `codes` array
3. Remove the code from the array

**Code:**
```typescript
await removeBetaAccessCode("OLDCODE");
```

### Disabling Specific Codes

Simply remove them from the `codes` array. They'll immediately stop working.

## User Experience

### When Codes Are Required (`enabled: false`)

- Signup form shows "Beta Access Code" field
- Field is **required** (though marked optional in UI for flexibility)
- If code is missing or invalid, signup fails with error message
- Error message can be customized via `message` field

### When Codes Are Optional (`enabled: true`)

- Signup form shows "Beta Access Code" field (optional)
- Users can sign up without a code
- Users with codes can enter them (for tracking/analytics)

### When No Config Exists

- Signup is open to everyone
- No beta code field validation
- Public signup mode

## Security Notes

⚠️ **Important:**
- Beta codes are **not encrypted** - they're stored as plain text in Firebase
- Anyone with access to Firebase can see the codes
- For production, consider:
  - Using Firebase Security Rules to restrict access
  - Implementing rate limiting on signup attempts
  - Adding expiration dates to codes
  - Using more complex code generation

## Example Firebase Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only authenticated admins can read/write beta access config
    match /betaAccess/config {
      allow read: if request.auth != null && 
                     get(/databases/$(database)/documents/companies/$(request.auth.token.companyId)/members/$(request.auth.uid)).data.role == 'admin';
      allow write: if request.auth != null && 
                      get(/databases/$(database)/documents/companies/$(request.auth.token.companyId)/members/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

## Testing

1. **Test with code required:**
   - Set `enabled: false`, add test code `["TEST123"]`
   - Try signing up without code → should fail
   - Try signing up with invalid code → should fail
   - Try signing up with `TEST123` → should succeed

2. **Test with codes optional:**
   - Set `enabled: true`, add test code `["TEST123"]`
   - Try signing up without code → should succeed
   - Try signing up with `TEST123` → should succeed

3. **Test public mode:**
   - Delete config document
   - Try signing up → should succeed without code

