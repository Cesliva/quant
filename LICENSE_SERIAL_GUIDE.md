# License Serial Key System Guide

## Overview

The license serial key system allows you to distribute beta access with two different license tiers:
- **Single-User Licenses**: Full access including company settings
- **Multi-User Licenses**: Admin-only settings access, with setup prompts

## License Types

### Single-User License
- **Settings Access**: ✅ Full access to company settings
- **Use Case**: Individual testers who need full control
- **Format**: `XXXX-XXXX-XXXX-XXXX` (16 alphanumeric characters)

### Multi-User License
- **Settings Access**: ❌ Only administrators can access company settings
- **Use Case**: Team testing where settings should be restricted
- **Setup**: First-time users are prompted to complete setup
- **Format**: `XXXX-XXXX-XXXX-XXXX` (16 alphanumeric characters)

## Generating License Serials

### Using the Script

```bash
# Generate 10 single-user licenses
node scripts/generate-license-serials.js single-user 10

# Generate 5 multi-user licenses
node scripts/generate-license-serials.js multi-user 5
```

The script will output serial keys in the format: `XXXX-XXXX-XXXX-XXXX`

### Using the API

```bash
# Create a single-user license
POST /api/license-serials
{
  "type": "single-user",
  "maxUses": 1,
  "expiresInDays": 90,
  "description": "Beta tester license"
}

# Create a multi-user license
POST /api/license-serials
{
  "type": "multi-user",
  "maxUses": 10,
  "expiresInDays": 90,
  "description": "Team beta license"
}
```

### Manual Creation in Firebase

1. Generate a serial using the script
2. Go to Firebase Console → Firestore
3. Create document at: `licenseSerials/{serialHash}`
4. Use the hash from the script output (or hash the serial yourself)

## How It Works

### Signup Flow

1. User enters license serial during signup (optional field)
2. System validates the serial:
   - Checks if serial exists
   - Verifies it's active and not expired
   - Checks usage limits
   - For single-user: ensures it's not already used
3. License is activated and linked to the company
4. User permissions are set based on license type:
   - **Single-user**: `canAccessSettings: true`
   - **Multi-user**: `canAccessSettings: false` (only admins can access settings)

### Multi-User Setup

When a user signs up with a multi-user license:
1. They are redirected to `/setup/multi-user` after signup
2. Setup page explains the license restrictions
3. User completes setup (can skip)
4. Company `needsSetup` flag is cleared

### Settings Access Control

- **Single-user licenses**: All users with admin role can access settings
- **Multi-user licenses**: Only users with admin role AND `canAccessSettings: true` can access settings
- The sidebar button shows a disabled state for non-admin users
- Clear error messages explain why access is restricted

## Firestore Structure

### License Serial Document
```
/licenseSerials/{serialHash}
{
  serial: string (hashed),
  type: "single-user" | "multi-user",
  status: "active" | "used" | "expired" | "revoked",
  maxUses?: number,
  currentUses: number,
  expiresAt?: Date,
  createdAt: Date,
  companyId?: string,
  activatedAt?: Date
}
```

### Company Document
```
/companies/{companyId}
{
  licenseType: "single-user" | "multi-user",
  licenseSerial: string (hash),
  needsSetup: boolean (multi-user only),
  ...
}
```

### Member Document
```
/companies/{companyId}/members/{userId}
{
  permissions: {
    canAccessSettings: boolean
  },
  role: "admin" | "estimator" | "viewer",
  ...
}
```

## API Endpoints

### GET /api/license-serials
List all license serials (optionally filtered by type)

### POST /api/license-serials
Create a new license serial
```json
{
  "type": "single-user" | "multi-user",
  "maxUses": number (optional),
  "expiresInDays": number (optional),
  "description": string (optional)
}
```

### DELETE /api/license-serials?serialHash={hash}
Delete a license serial

## Best Practices

1. **Generate serials in batches** for easier distribution
2. **Set expiration dates** for time-limited beta access
3. **Use maxUses: 1** for single-user licenses to prevent reuse
4. **Track usage** by monitoring `currentUses` in Firestore
5. **Revoke licenses** by setting `status: "revoked"` if needed

## Testing

1. Generate test serials using the script
2. Create them via API or Firebase Console
3. Test signup with both license types
4. Verify settings access restrictions work correctly
5. Test multi-user setup flow

## Troubleshooting

- **"Invalid license serial key"**: Serial doesn't exist or wasn't created properly
- **"License already in use"**: Single-user license was already activated
- **"License expired"**: Check `expiresAt` field in Firestore
- **Settings access denied**: Check `canAccessSettings` permission in member document

