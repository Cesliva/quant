# Beta Access System Upgrade

## What Changed

The beta access system has been upgraded from a simple array-based system to a **secure, enterprise-grade** system with advanced security features.

## New Security Features

### ✅ Before (Old System)
- Simple array of codes in Firebase
- No rate limiting
- No expiration dates
- No usage tracking
- Codes stored in plain text
- Easy to guess codes

### ✅ After (New System)
- **Individual code documents** with full metadata
- **Rate limiting** (5 attempts per 15 minutes, then 15-minute lockout)
- **Code expiration** dates
- **Usage tracking** (single-use, limited-use, or unlimited)
- **Hashed storage** (SHA-256, codes never stored in plain text)
- **IP-based lockout** after failed attempts
- **Secure code generation** (12-character alphanumeric codes)

## Migration Path

### Option 1: Fresh Start (Recommended)
1. **Create new codes** using the secure system
2. **Share new codes** with beta testers
3. **Old codes will stop working** (forces migration to secure system)

### Option 2: Gradual Migration
1. **Keep old system active** temporarily
2. **Create new codes** in secure system
3. **Migrate users** to new codes
4. **Disable old system** once migration complete

## Quick Start

### 1. Initialize Configuration

**Firebase Console:**
```
/betaAccess/config
{
  "enabled": false,
  "message": "Beta access code is required. Contact support@quant.com for access.",
  "rateLimitAttempts": 5,
  "rateLimitWindowMinutes": 15,
  "lockoutDurationMinutes": 15
}
```

### 2. Create Your First Secure Code

**Via API:**
```bash
POST /api/beta-codes
{
  "maxUses": 10,
  "expiresInDays": 30,
  "description": "Beta tester code"
}

# Response:
{
  "success": true,
  "code": "A3K7-B2M9-X4P8",  # Save this! Only shown once
  "betaCode": { ... }
}
```

**Via Code:**
```typescript
import { createBetaCode, generateSecureCode } from "@/lib/utils/betaAccessSecure";

const code = generateSecureCode(); // "A3K7-B2M9-X4P8"
await createBetaCode(code, {
  maxUses: 10,
  expiresInDays: 30,
  description: "Beta tester code"
});
```

### 3. Share Codes Securely

- **Never share codes in public channels**
- **Use secure communication** (email, encrypted messages)
- **One code per tester** (for tracking)
- **Set expiration dates** (e.g., 30 days)

## Code Examples

### Single-Use Code
```typescript
await createBetaCode("VIP-ACCESS", {
  maxUses: 1,
  expiresInDays: 7,
  description: "One-time VIP access"
});
```

### Team Code (5 uses)
```typescript
await createBetaCode("TEAM-BETA", {
  maxUses: 5,
  expiresInDays: 60,
  description: "Team beta access"
});
```

### Unlimited Code
```typescript
await createBetaCode("PUBLIC-BETA", {
  // No maxUses = unlimited
  expiresInDays: 90,
  description: "Public beta code"
});
```

## Security Improvements

### Rate Limiting
- **5 failed attempts** → 15-minute lockout
- **IP-based tracking** prevents brute force
- **Automatic reset** after lockout period

### Code Protection
- **SHA-256 hashing** - codes never stored in plain text
- **Case-insensitive** validation
- **Automatic trimming** of whitespace

### Usage Control
- **Track every use** of each code
- **Enforce limits** automatically
- **Disable codes** without deleting

## Backward Compatibility

⚠️ **Important**: The old array-based system is **no longer used**. 

- Old codes in `/betaAccess/config.codes` array will **not work**
- You must create new codes using the secure system
- This is intentional - forces migration to secure system

## Testing

1. **Create a test code:**
   ```bash
   POST /api/beta-codes
   { "maxUses": 1, "expiresInDays": 1 }
   ```

2. **Try signup with code** → Should work

3. **Try signup with invalid code** → Should fail

4. **Try 5 invalid codes** → Should lockout IP

5. **Wait 15 minutes** → Should be able to try again

## Documentation

- **Full Guide**: See `SECURE_BETA_ACCESS_GUIDE.md`
- **API Reference**: See code comments in `lib/utils/betaAccessSecure.ts`
- **Old Guide**: `BETA_ACCESS_GUIDE.md` (deprecated)

## Support

If you encounter issues:
1. Check Firebase Console for code status
2. Verify code hasn't expired
3. Check usage limit hasn't been exceeded
4. Verify rate limiting isn't blocking you
5. Check code is active (`isActive: true`)

