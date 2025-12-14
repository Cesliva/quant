# How to Fix Owner Access for Existing User

## Problem
You're signed in but don't have admin/owner access even though you're the first/only user.

## Solution Options

### Option 1: Fix via Firebase Console (Recommended)

1. **Go to Firebase Console** → Firestore Database
2. **Find your company document**: `companies/{yourCompanyId}`
3. **Check/Set ownerId**:
   - Look for `ownerId` field
   - If missing or wrong, set it to your Firebase Auth user ID (UID)
   - Your UID can be found in Firebase Console → Authentication → Users

4. **Find/Create member document**: `companies/{yourCompanyId}/members/{yourUserId}`
5. **Set member data**:
   ```json
   {
     "userId": "your-firebase-uid",
     "email": "your-email@example.com",
     "name": "Your Name",
     "role": "owner",
     "permissions": {
       "canCreateProjects": true,
       "canEditProjects": true,
       "canDeleteProjects": true,
       "canViewReports": true,
       "canManageUsers": true,
       "canAccessSettings": true
     },
     "status": "active",
     "joinedAt": "2024-12-13T00:00:00Z"
   }
   ```

6. **Refresh your browser** - permissions should update automatically

### Option 2: Use Browser Console (Quick Fix)

1. Open browser console (F12)
2. Run this code (replace with your actual values):

```javascript
// Get your user ID from Firebase Auth
import { getAuth } from 'firebase/auth';
const auth = getAuth();
const userId = auth.currentUser?.uid;
console.log('Your User ID:', userId);

// Then manually update in Firestore Console:
// 1. Set companies/{companyId}/ownerId = userId
// 2. Create/update companies/{companyId}/members/{userId} with role: "owner"
```

### Option 3: Create Admin Fix Script

See `scripts/fix-owner-access.ts` (create this if needed)

## How to Find Your User ID

1. **Firebase Console**:
   - Go to Authentication → Users
   - Find your email
   - Copy the UID

2. **Browser Console**:
   - Open DevTools (F12)
   - Run: `JSON.parse(localStorage.getItem('firebase:authUser:...'))` 
   - Or check Network tab for API calls with your UID

## Verification

After fixing, check:
- Settings page should be accessible
- Sidebar should show "Company Settings" link
- User profile should show "Workspace Owner" label


