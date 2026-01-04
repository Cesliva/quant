# Deploy Firebase Storage Rules

The logo upload is failing because Firebase Storage rules haven't been deployed yet.

## Option 1: Deploy via Firebase Console (Easiest)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click **Storage** in the left sidebar
4. Click the **Rules** tab
5. Copy the contents of `storage.rules` file
6. Paste into the rules editor
7. Click **Publish**

## Option 2: Deploy via Firebase CLI

1. Open terminal in project directory
2. Run: `firebase login`
3. Run: `firebase use <your-project-id>`
4. Run: `firebase deploy --only storage`

## Verify Rules Are Deployed

After deploying, the rules should allow:
- ✅ Authenticated users can upload logos to `companies/{companyId}/branding/`
- ✅ Anyone can read logos (for display)
- ✅ Authenticated users can upload avatars

## Test Upload

After deploying rules, try uploading a logo again. If it still fails:
1. Open browser DevTools (F12)
2. Check Console tab for errors
3. Check Network tab for failed requests
4. Share the error message

