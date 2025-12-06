# Setup Beta Access Configuration

## Quick Setup (Recommended)

### Option 1: Using API Route (Easiest)

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Call the setup API:**
   ```bash
   curl -X POST http://localhost:3000/api/setup-beta-access \
     -H "Content-Type: application/json" \
     -d '{
       "enabled": false,
       "codes": ["BETA2024", "QUANT2024", "STEEL2024"],
       "message": "Beta access code required. Contact support for access."
     }'
   ```

   Or use a tool like Postman, or visit:
   ```
   http://localhost:3000/api/setup-beta-access
   ```
   (Note: GET shows current config, POST creates/updates it)

### Option 2: Using Setup Script

1. **Run the setup script:**
   ```bash
   node scripts/setup-beta-access.js
   ```

2. **Or with custom configuration:**
   ```bash
   node scripts/setup-beta-access.js --enabled=false --codes=BETA2024,QUANT2024,STEEL2024
   ```

### Option 3: Manual Firebase Console Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Firestore Database**
4. Click **Start collection** (if no collections exist)
5. Collection ID: `betaAccess`
6. Document ID: `config`
7. Add fields:
   - `enabled` (boolean): `false`
   - `codes` (array): `["BETA2024", "QUANT2024", "STEEL2024"]`
   - `message` (string): `"Beta access code required. Contact support for access."`

## Default Configuration

The setup will create this default configuration:

```json
{
  "enabled": false,
  "codes": ["BETA2024", "QUANT2024", "STEEL2024"],
  "message": "Beta access code is required. Please contact support for access."
}
```

This means:
- ✅ Beta codes are **required** for signup
- ✅ Users must enter one of: `BETA2024`, `QUANT2024`, or `STEEL2024`
- ✅ Custom error message shown if code is missing/invalid

## Custom Configuration Examples

### Require Codes with Custom Message

```bash
curl -X POST http://localhost:3000/api/setup-beta-access \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": false,
    "codes": ["BETA2024", "QUANT2024"],
    "message": "Beta access is currently limited. Contact beta@quant.com for a code."
  }'
```

### Make Codes Optional (Open Beta)

```bash
curl -X POST http://localhost:3000/api/setup-beta-access \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "codes": ["VIP2024", "EARLY2024"],
    "message": ""
  }'
```

### Disable Beta Requirement (Public Signup)

```bash
curl -X POST http://localhost:3000/api/setup-beta-access \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "codes": [],
    "message": ""
  }'
```

Or simply **delete** the `betaAccess/config` document in Firebase.

## Verify Setup

Check if configuration exists:

```bash
curl http://localhost:3000/api/setup-beta-access
```

Or visit in browser: `http://localhost:3000/api/setup-beta-access`

## Managing Codes After Setup

### Add New Codes

1. Go to Firebase Console → Firestore
2. Open `betaAccess/config` document
3. Edit the `codes` array
4. Add new code: `["BETA2024", "QUANT2024", "NEWCODE2024"]`

### Remove Codes

1. Go to Firebase Console → Firestore
2. Open `betaAccess/config` document
3. Edit the `codes` array
4. Remove the code from the array

### Disable Beta Requirement

1. Go to Firebase Console → Firestore
2. Open `betaAccess/config` document
3. Change `enabled` to `true`
4. Save

### Temporarily Shut Down Signups

1. Go to Firebase Console → Firestore
2. Open `betaAccess/config` document
3. Set `enabled` to `false`
4. Set `codes` to `[]` (empty array)
5. Set `message` to `"Signups are currently closed. Please check back soon."`

## Testing

1. **Test with code required:**
   - Set `enabled: false`, codes: `["TEST123"]`
   - Try signing up without code → should fail
   - Try signing up with `TEST123` → should succeed

2. **Test with codes optional:**
   - Set `enabled: true`, codes: `["TEST123"]`
   - Try signing up without code → should succeed
   - Try signing up with `TEST123` → should succeed

3. **Test public mode:**
   - Delete `betaAccess/config` document
   - Try signing up → should succeed without code

## Troubleshooting

### "Firebase is not configured"
- Check `.env.local` has Firebase credentials
- Make sure `NEXT_PUBLIC_FIREBASE_*` variables are set

### "Failed to setup beta access"
- Check Firebase Console → Firestore is enabled
- Verify you have write permissions
- Check browser console for detailed errors

### Codes not working
- Verify codes are in the `codes` array (case-sensitive)
- Check `enabled` is set correctly
- Ensure no extra spaces in codes

