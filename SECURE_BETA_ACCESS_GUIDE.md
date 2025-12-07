# Secure Beta Access Code System

## Overview

The secure beta access system provides enterprise-grade protection against unauthorized access attempts. It includes:

- **Individual code documents** with metadata (not just an array)
- **Rate limiting** to prevent brute force attacks
- **Code expiration** dates
- **Usage tracking** (single-use or limited-use codes)
- **IP-based lockout** after failed attempts
- **Hashed code storage** for security
- **Secure code generation** (12-character alphanumeric)

## Security Features

### 1. Rate Limiting
- **Default**: 5 failed attempts per 15 minutes
- **Lockout**: 15 minutes after max attempts
- **IP-based**: Tracks attempts per IP address
- **Configurable**: Adjust limits in Firebase config

### 2. Code Expiration
- Codes can have expiration dates
- Expired codes are automatically rejected
- Useful for time-limited beta access

### 3. Usage Limits
- **Unlimited**: `maxUses` = undefined
- **Single-use**: `maxUses` = 1
- **Limited**: `maxUses` = any number
- Tracks usage count automatically

### 4. Code Hashing
- Codes are stored as SHA-256 hashes
- Original codes are never stored in plain text
- Prevents code theft from database access

## Firebase Structure

### Configuration
```
/betaAccess/config
{
  enabled: boolean,                    // false = codes REQUIRED
  message?: string,                    // Custom error message
  rateLimitAttempts: number,           // Max attempts (default: 5)
  rateLimitWindowMinutes: number,      // Time window (default: 15)
  lockoutDurationMinutes: number       // Lockout time (default: 15)
}
```

### Individual Codes
```
/betaAccess/codes/{codeHash}
{
  id: string,                         // Code hash (document ID)
  codeHash: string,                   // SHA-256 hash
  maxUses?: number,                   // undefined = unlimited
  currentUses: number,                // Usage count
  expiresAt?: Date,                    // Expiration date
  createdAt: Date,
  createdBy?: string,                  // Admin who created it
  isActive: boolean,                   // Can be disabled
  description?: string                 // Optional description
}
```

### Rate Limiting
```
/betaAccess/rateLimits/{ipHash}
{
  ip: string,
  attempts: number,
  lastAttempt: Date,
  lockedUntil?: Date                  // Lockout expiration
}
```

## Setup

### 1. Initialize Configuration

**Via Firebase Console:**
1. Go to Firestore Database
2. Create collection: `betaAccess`
3. Create document: `config`
4. Add fields:
```json
{
  "enabled": false,
  "message": "Beta access code is required. Contact support@quant.com for access.",
  "rateLimitAttempts": 5,
  "rateLimitWindowMinutes": 15,
  "lockoutDurationMinutes": 15
}
```

**Via API:**
```typescript
import { updateBetaAccessConfig } from "@/lib/utils/betaAccessSecure";

await updateBetaAccessConfig({
  enabled: false,
  rateLimitAttempts: 5,
  rateLimitWindowMinutes: 15,
  lockoutDurationMinutes: 15,
  message: "Beta access code required. Contact support."
});
```

### 2. Create Beta Codes

**Generate Secure Code Automatically:**
```typescript
import { createBetaCode, generateSecureCode } from "@/lib/utils/betaAccessSecure";

// Generate and create a code
const code = generateSecureCode(); // e.g., "A3K7-B2M9-X4P8"
const betaCode = await createBetaCode(code, {
  maxUses: 10,              // Can be used 10 times
  expiresInDays: 30,        // Expires in 30 days
  description: "Beta tester code for Q1 2024"
});
```

**Via API:**
```bash
POST /api/beta-codes
{
  "maxUses": 10,
  "expiresInDays": 30,
  "description": "Beta tester code"
}

# Response includes the generated code (only shown once!)
{
  "success": true,
  "code": "A3K7-B2M9-X4P8",
  "betaCode": { ... }
}
```

**Create Custom Code:**
```typescript
await createBetaCode("MY-CUSTOM-CODE", {
  maxUses: 1,              // Single-use code
  expiresInDays: 7,        // Expires in 7 days
  description: "VIP access code"
});
```

## Code Types

### Single-Use Code
```typescript
await createBetaCode("VIP-CODE", {
  maxUses: 1,
  description: "One-time use code"
});
```

### Limited-Use Code
```typescript
await createBetaCode("TEAM-CODE", {
  maxUses: 5,
  expiresInDays: 60,
  description: "Team beta access (5 uses)"
});
```

### Unlimited Code
```typescript
await createBetaCode("PUBLIC-BETA", {
  // maxUses not specified = unlimited
  expiresInDays: 90,
  description: "Public beta code"
});
```

### Never-Expiring Code
```typescript
await createBetaCode("PERMANENT-CODE", {
  maxUses: 100,
  // expiresInDays not specified = never expires
  description: "Permanent access code"
});
```

## Managing Codes

### List All Codes
```typescript
import { getAllBetaCodes } from "@/lib/utils/betaAccessSecure";

const codes = await getAllBetaCodes();
codes.forEach(code => {
  console.log(`Code: ${code.codeHash}`);
  console.log(`Uses: ${code.currentUses}/${code.maxUses || 'unlimited'}`);
  console.log(`Active: ${code.isActive}`);
});
```

### Deactivate a Code
```typescript
import { deactivateBetaCode } from "@/lib/utils/betaAccessSecure";

// Deactivate by code hash
await deactivateBetaCode(codeHash);
```

**Via API:**
```bash
PATCH /api/beta-codes
{
  "action": "deactivate",
  "codeHash": "abc123..."
}
```

### Update Configuration
```typescript
await updateBetaAccessConfig({
  rateLimitAttempts: 10,        // Increase to 10 attempts
  lockoutDurationMinutes: 30,   // 30 minute lockout
});
```

## User Experience

### When Codes Are Required

1. User enters code on signup form
2. System validates code:
   - Checks if code exists (hashed lookup)
   - Verifies code is active
   - Checks expiration date
   - Verifies usage limit not exceeded
3. If invalid:
   - Records failed attempt
   - Checks rate limiting
   - Locks out IP if too many attempts
4. If valid:
   - Increments usage count
   - Clears rate limit for IP
   - Allows signup

### Rate Limiting Behavior

- **First 4 failed attempts**: User can keep trying
- **5th failed attempt**: IP locked for 15 minutes
- **Lockout message**: "Too many failed attempts. Please try again in X minutes."
- **After lockout expires**: Attempts reset, user can try again

## Security Best Practices

### 1. Use Strong Codes
- **Recommended**: Use auto-generated codes (12 characters)
- **Format**: `XXXX-XXXX-XXXX` (alphanumeric, no confusing chars)
- **Avoid**: Simple codes like "BETA2024", "TEST123"

### 2. Set Expiration Dates
- Always set expiration for time-limited access
- Review and extend as needed

### 3. Monitor Usage
- Check `currentUses` regularly
- Deactivate codes that are compromised
- Rotate codes periodically

### 4. Configure Rate Limits
- Adjust based on your threat model
- Stricter limits for sensitive betas
- More lenient for open betas

### 5. IP Lockout
- Prevents brute force attacks
- Automatically resets after lockout period
- Consider whitelisting known IPs if needed

## Migration from Old System

If you're migrating from the old array-based system:

1. **Create new codes** using the secure system
2. **Update config** to use new structure
3. **Old codes will stop working** (by design - forces migration)
4. **Share new codes** with beta testers

## API Endpoints

### GET /api/beta-codes
Get all beta codes (admin only)

### POST /api/beta-codes
Create a new beta code
```json
{
  "code": "optional-custom-code",
  "maxUses": 10,
  "expiresInDays": 30,
  "description": "Beta tester code"
}
```

### PATCH /api/beta-codes
Update config or deactivate code
```json
{
  "action": "deactivate",
  "codeHash": "abc123..."
}
```

## Troubleshooting

### Issue: Codes not working
- Check if code is active (`isActive: true`)
- Verify expiration date hasn't passed
- Check usage limit hasn't been exceeded
- Ensure code hash matches (case-insensitive)

### Issue: Rate limiting too strict
- Adjust `rateLimitAttempts` in config
- Increase `rateLimitWindowMinutes`
- Reduce `lockoutDurationMinutes`

### Issue: IP locked out
- Wait for lockout period to expire
- Clear rate limit record in Firebase (if needed)
- Use different IP address (not recommended for production)

## Example Workflow

1. **Create beta codes** for your testers
2. **Set expiration** dates (e.g., 30 days)
3. **Set usage limits** (e.g., 1 use per code)
4. **Share codes** securely with testers
5. **Monitor usage** via Firebase Console
6. **Deactivate** codes when no longer needed
7. **Generate new codes** for next batch

## Production Recommendations

1. **Add authentication** to API endpoints (admin only)
2. **Log all code usage** for audit trail
3. **Set up alerts** for suspicious activity
4. **Regular code rotation** (monthly/quarterly)
5. **Monitor rate limit triggers** for attack patterns
6. **Use HTTPS** for all API calls
7. **Implement CAPTCHA** on signup form (optional)

