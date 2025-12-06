# Manual Firebase Setup for Beta Access

Since Firebase isn't configured yet, here's how to set up the beta access configuration manually:

## Step 1: Go to Firebase Console

1. Visit [Firebase Console](https://console.firebase.google.com)
2. Select your project (or create one if needed)

## Step 2: Open Firestore Database

1. Click **Firestore Database** in the left sidebar
2. If you haven't created a database yet, click **Create database**
3. Choose **Start in test mode** (or production mode with proper rules)

## Step 3: Create Beta Access Collection

1. Click **Start collection** (or **Add collection** if collections exist)
2. Collection ID: `betaAccess`
3. Click **Next**

## Step 4: Create Config Document

1. Document ID: `config`
2. Click **Add field** and add these fields:

### Field 1: `enabled`
- Type: **boolean**
- Value: `false` (this means codes are REQUIRED)

### Field 2: `codes`
- Type: **array**
- Click **Add item** and add:
  - `BETA2024`
  - `QUANT2024`
  - `STEEL2024`

### Field 3: `message`
- Type: **string**
- Value: `Beta access code is required. Please contact support for access.`

## Step 5: Save

Click **Save** to create the document.

## Result

Your Firebase structure should look like:

```
betaAccess (collection)
  └── config (document)
      ├── enabled: false
      ├── codes: ["BETA2024", "QUANT2024", "STEEL2024"]
      └── message: "Beta access code is required. Please contact support for access."
```

## Verify Setup

After creating the document:
1. Go to your signup page: `http://localhost:3000/signup`
2. Try signing up without a code → should show error
3. Try signing up with `BETA2024` → should work

## Alternative: Use Setup Page (Once Firebase is Configured)

Once you have Firebase credentials in `.env.local`:

1. Visit: `http://localhost:3000/setup-beta-access`
2. Click **"Setup Closed Beta"**
3. Done!

## Quick Reference: Configuration Options

### Closed Beta (Require Codes)
```json
{
  "enabled": false,
  "codes": ["BETA2024", "QUANT2024", "STEEL2024"],
  "message": "Beta access code required. Contact support."
}
```

### Open Beta (Optional Codes)
```json
{
  "enabled": true,
  "codes": ["VIP2024", "EARLY2024"],
  "message": ""
}
```

### Public Signup (No Restrictions)
```json
{
  "enabled": true,
  "codes": [],
  "message": ""
}
```

Or simply **don't create the document** - if it doesn't exist, signups are open.

