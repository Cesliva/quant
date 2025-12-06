# Signup & Multi-User Functionality Guide

## ✅ Signup Functionality (Firebase)

### How It Works

1. **User fills out signup form** at `/signup`
   - Full name
   - Company name
   - Email address
   - Password (with validation)
   - Beta access code (optional, if required)

2. **API Route** (`/api/auth/signup`) processes signup:
   - Validates beta access code (if required)
   - Creates Firebase Auth user account
   - Generates unique company ID
   - Creates company document in Firestore
   - Creates user member document with admin role
   - Creates user reference document

3. **User is automatically signed in** and redirected to `/dashboard`

### Firebase Structure Created

```
/companies/{companyId}/
  ├── companyName
  ├── createdAt
  ├── ownerId
  └── settings/
      ├── materialRate
      ├── laborRate
      └── coatingTypes

/companies/{companyId}/members/{userId}/
  ├── userId
  ├── email
  ├── name
  ├── role: "admin"
  ├── permissions: { ... }
  ├── status: "active"
  └── joinedAt

/users/{userId}/
  ├── email
  ├── name
  ├── company: {companyId}
  └── createdAt
```

### Beta Access Code System

See `BETA_ACCESS_GUIDE.md` for detailed instructions.

**Quick Setup:**
1. Go to Firebase Console → Firestore
2. Create collection: `betaAccess`
3. Create document: `config`
4. Add:
   ```json
   {
     "enabled": false,
     "codes": ["BETA2024", "QUANT2024"],
     "message": "Beta access code required. Contact support."
   }
   ```

**To disable beta requirement:**
- Set `enabled: true` OR delete the config document

**To add/remove codes:**
- Edit the `codes` array in Firebase Console

## ✅ Multi-User Collaboration (Fully Functional)

### Features Implemented

#### 1. **User Presence** ✅
- **Component**: `UserPresence` (visible on estimating pages)
- **What it does**: Shows who's currently viewing the same project/page
- **Real-time**: Updates every 30 seconds
- **Location**: Top-right of estimating pages

**Example:**
```
Active: [🟢 John Doe (estimating)] [🟢 Jane Smith (details)]
```

#### 2. **Edit Locking** ✅
- **Hook**: `useEditLock`
- **Component**: `LockIndicator`
- **What it does**: Prevents two users from editing the same section simultaneously
- **Real-time**: Locks are acquired/released instantly
- **Visual feedback**: Shows who has a section locked

#### 3. **Activity Tracking** ✅
- **Component**: `ActivityFeed`
- **What it does**: Logs all user actions (create, update, delete, view)
- **Real-time**: Updates as actions happen
- **Location**: Can be added to any page

#### 4. **Comments System** ✅
- **Component**: `CommentsPanel`
- **What it does**: Allows users to add comments to projects, sections, or line items
- **Real-time**: Comments appear instantly for all users
- **Features**: 
  - Section-specific comments
  - Line-item comments
  - User avatars and names
  - Delete own comments

#### 5. **Notifications** ✅
- **Component**: `NotificationBell`
- **What it does**: Real-time notifications for locks, unlocks, and other events
- **Features**:
  - Unread count badge
  - Dropdown notification panel
  - Click to navigate to relevant pages

#### 6. **Conflict Resolution** ✅
- **Utility**: `conflictResolution.ts`
- **What it does**: Detects and resolves conflicts when multiple users edit simultaneously
- **Features**: 
  - Last-write-wins with timestamps
  - Manual conflict resolution UI
  - Preserves user changes

### Where Multi-User Features Are Active

✅ **Estimating Pages** (`/projects/[id]/estimating`)
- User Presence (top-right)
- Activity Feed
- Comments Panel
- Edit Locking (on line items)

✅ **Project Details** (`/projects/[id]/details`)
- User Presence
- Activity Feed
- Comments Panel

✅ **All Project Pages**
- Real-time data sync via Firestore subscriptions
- Multiple users see changes instantly

### How to Use Multi-User Features

#### Adding User Presence to a Page

```tsx
import { UserPresence } from "@/components/collaboration/UserPresence";

<UserPresence projectId={projectId} currentPage="estimating" />
```

#### Adding Activity Feed

```tsx
import { ActivityFeed } from "@/components/collaboration/ActivityFeed";

<ActivityFeed projectId={projectId} />
```

#### Adding Comments

```tsx
import { CommentsPanel } from "@/components/collaboration/CommentsPanel";

<CommentsPanel projectId={projectId} section="estimating" />
```

#### Using Edit Locks

```tsx
import { useEditLock } from "@/lib/hooks/useEditLock";

const { isLocked, lockedBy, acquireLock, releaseLock } = useEditLock(projectId, "section-name");

// Before editing
if (!isLocked) {
  await acquireLock();
  // ... do editing
  await releaseLock();
}
```

### Real-Time Data Flow

1. **User A** makes a change (e.g., updates a line item)
2. Change is saved to Firestore
3. **User B** sees the change instantly via Firestore `onSnapshot` subscription
4. No page refresh needed - updates are live

### Firebase Structure for Collaboration

```
/companies/{companyId}/projects/{projectId}/
  ├── activeUsers/{userId}/        # Real-time presence
  │   ├── name
  │   ├── viewing
  │   └── lastSeen
  ├── locks/{section}/              # Edit locks
  │   ├── userId
  │   ├── userName
  │   └── lockedAt
  ├── activities/{activityId}/      # Activity log
  │   ├── userId
  │   ├── action
  │   ├── timestamp
  │   └── details
  └── comments/
      ├── general/                  # General comments
      ├── section_{section}/        # Section comments
      └── line_{lineId}/            # Line-item comments
```

## Testing Multi-User Features

1. **Open two browser windows** (or use incognito + regular)
2. **Sign in as different users** (or same user in different windows)
3. **Navigate to the same project** in both windows
4. **Observe:**
   - User presence shows in both windows
   - Changes in one window appear instantly in the other
   - Edit locks prevent simultaneous edits
   - Comments appear in real-time

## Security & Permissions

### User Roles

- **Admin**: Full access (create, edit, delete projects, manage users)
- **Estimator**: Can create/edit projects, view reports (no delete, no user management)
- **Viewer**: Read-only access (view reports only)

### Permissions Structure

```typescript
permissions: {
  canCreateProjects: boolean;
  canEditProjects: boolean;
  canDeleteProjects: boolean;
  canViewReports: boolean;
  canManageUsers: boolean;
}
```

## Troubleshooting

### Signup Issues

- **"Beta access code required"**: Check Firebase `betaAccess/config` - set `enabled: true` or add valid code
- **"Firebase not configured"**: Check `.env.local` has Firebase credentials
- **"Email already in use"**: User already exists - use login instead

### Multi-User Issues

- **Not seeing other users**: Check that both users are on the same project
- **Changes not syncing**: Check Firebase connection, ensure `onSnapshot` subscriptions are active
- **Locks not working**: Check Firestore rules allow write access to `/locks/` path

## Next Steps

1. **Set up beta access codes** (see `BETA_ACCESS_GUIDE.md`)
2. **Test multi-user features** with multiple browser windows
3. **Configure Firebase Security Rules** for production
4. **Set up email invitations** for team members (see `COLLABORATION_FEATURES.md`)

