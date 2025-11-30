# Development Setup Guide

## Getting Started

For development, simply sign up with your own account. The first user automatically becomes an admin.

### Initial Setup (One Time)
1. Navigate to: `http://localhost:3001/signup`
2. Fill in your details (name, company name, email, password)
3. Click "Create Account"
4. You'll be automatically logged in and set as admin

### Benefits
- ✅ Quick setup - no special configuration needed
- ✅ Your own company data
- ✅ Custom settings
- ✅ Can test multi-user scenarios by creating additional accounts

## Development Workflow

### Starting Development Server
```bash
npm run dev -- -p 3001
```

### Access Points
- **Landing Page:** `http://localhost:3001`
- **Login:** `http://localhost:3001/login`
- **Signup:** `http://localhost:3001/signup`
- **Dashboard:** `http://localhost:3001/dashboard` (after login)

### Firebase Setup
Make sure your `.env.local` has:
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
OPENAI_API_KEY=your_openai_key
```

### Resetting Development Data

If you need to reset:
1. Go to Firebase Console
2. Delete the user from Authentication
3. Delete company data from Firestore (optional)
4. Sign up again with a new account

## Testing Different User Roles

To test different roles:
1. Create users via signup or invite system
2. Manually change role in Firestore: `companies/{companyId}/members/{userId}`
3. Set `role` field to: `"admin"`, `"estimator"`, or `"viewer"`

## Quick Commands

```bash
# Start dev server
npm run dev -- -p 3001

# Build for production
npm run build

# Run linter
npm run lint

# Run tests
npm test
```

## Troubleshooting

### "Firebase is not configured"
- Check `.env.local` exists
- Verify all `NEXT_PUBLIC_*` variables are set
- Restart dev server after changing `.env.local`

### "Admin user not found"
- Sign up with a new account at `/signup`
- The first user automatically becomes admin

### "Permission denied" errors
- Check Firestore security rules
- Verify user has correct role in Firestore
- Check user is member of company

