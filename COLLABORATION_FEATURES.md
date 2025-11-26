# Multi-User Collaboration Features

## Overview
Complete multi-user collaboration system for the Quant Steel Estimating application, enabling multiple estimators to work together on projects in real-time.

## ✅ Implemented Features

### 1. **User Presence System**
- **Hook**: `lib/hooks/useUserPresence.ts`
- **Component**: `components/collaboration/UserPresence.tsx`
- **Features**:
  - Real-time tracking of who's viewing which page
  - Heartbeat updates every 30 seconds
  - Auto-cleanup when users leave
  - Visual indicators with user names and current page

### 2. **Edit Locking System**
- **Hook**: `lib/hooks/useEditLock.ts`
- **Component**: `components/collaboration/LockIndicator.tsx`
- **Features**:
  - Prevents concurrent edits on sections
  - Real-time lock status updates
  - Visual warnings when sections are locked
  - Automatic notifications when locks are acquired/released

### 3. **Activity Tracking**
- **Utility**: `lib/utils/activityLogger.ts`
- **Component**: `components/collaboration/ActivityFeed.tsx`
- **Features**:
  - Logs all user actions (create, update, delete, view)
  - Real-time activity feed
  - Formatted timestamps
  - Activity details and context

### 4. **Notification System**
- **Hook**: `lib/hooks/useNotifications.ts`
- **Component**: `components/collaboration/NotificationBell.tsx`
- **Features**:
  - Real-time notifications for locks/unlocks
  - Unread count badge
  - Mark as read functionality
  - Dropdown notification panel
  - Click to navigate to relevant pages

### 5. **Comments System**
- **Component**: `components/collaboration/CommentsPanel.tsx`
- **Features**:
  - Section-specific comments
  - Line-item specific comments
  - Real-time comment updates
  - User avatars and names
  - Delete own comments
  - Activity logging for comments

### 6. **Conflict Resolution**
- **Utility**: `lib/utils/conflictResolution.ts`
- **Features**:
  - Detects conflicts between local and remote edits
  - Smart merge strategy (prefers larger values for numeric fields)
  - Automatic conflict resolution
  - Integrated into estimating grid saves

### 7. **Email Invitations**
- **API Route**: `app/api/invite-user/route.ts`
- **Acceptance Page**: `app/(dashboard)/invite/[token]/page.tsx`
- **Features**:
  - Send invitation emails via Resend, SendGrid, or SMTP
  - Console mode for development
  - Invitation tokens with expiration
  - User account creation on acceptance
  - Automatic member assignment

### 8. **User Management**
- **Page**: `app/(dashboard)/settings/users/page.tsx`
- **Features**:
  - Invite users by email
  - Role management (Admin, Estimator, Viewer)
  - Permission-based access control
  - Remove members
  - View all team members

### 9. **User Profiles**
- **Component**: `components/collaboration/UserAvatar.tsx`
- **Page**: `app/(dashboard)/settings/users/profile/page.tsx`
- **Features**:
  - Upload profile avatars
  - Edit profile information
  - Display user avatars throughout app
  - User initials fallback

### 10. **Security Rules**
- **File**: `firestore.rules`
- **Features**:
  - Company membership verification
  - Project access control
  - Role-based permissions
  - Secure notification and comment access

## Integration Points

### Project Details Page
- User presence indicator
- Activity feed sidebar
- Comments panel
- Activity logging for saves and file operations

### Estimating Page
- User presence indicator
- Activity feed sidebar
- Comments panel
- Conflict resolution on line saves
- Activity logging for line operations

### Header
- Notification bell with unread count
- User avatar with profile link

## Data Structure

```
/companies/{companyId}/
  ├── members/{userId}/          # Team members with roles & permissions
  ├── invitations/{invitationId}/ # Pending invitations
  ├── notifications/{userId}/items/{notificationId}/ # User notifications
  └── projects/{projectId}/
      ├── activeUsers/{userId}/   # Real-time presence
      ├── locks/{section}/        # Edit locks
      ├── activities/{activityId}/ # Activity log
      └── comments/
          ├── general/            # General project comments
          ├── section_{section}/  # Section-specific comments
          └── line_{lineId}/      # Line-item comments
```

## Environment Variables

For email invitations, add to `.env.local`:

```env
# Email Service (choose one)
EMAIL_SERVICE=console  # Options: "console", "resend", "sendgrid", "smtp"

# For Resend
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com

# For SendGrid
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# App URL for invitation links
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## User Roles & Permissions

### Admin
- ✅ Create projects
- ✅ Edit projects
- ✅ Delete projects
- ✅ View reports
- ✅ Manage users

### Estimator
- ✅ Create projects
- ✅ Edit projects
- ❌ Delete projects
- ✅ View reports
- ❌ Manage users

### Viewer
- ❌ Create projects
- ❌ Edit projects
- ❌ Delete projects
- ✅ View reports
- ❌ Manage users

## Usage Examples

### Adding Presence to a Page
```typescript
import { UserPresence } from "@/components/collaboration/UserPresence";

<UserPresence projectId={projectId} currentPage="details" />
```

### Adding Comments
```typescript
import { CommentsPanel } from "@/components/collaboration/CommentsPanel";

<CommentsPanel projectId={projectId} section="estimating" />
```

### Logging Activity
```typescript
import { logActivity } from "@/lib/utils/activityLogger";

await logActivity(companyId, projectId, "created_line", { lineId: "L1" });
```

### Using Edit Locks
```typescript
import { useEditLock } from "@/lib/hooks/useEditLock";

const { lock, isLocked, canEdit, acquireLock, releaseLock } = useEditLock(projectId, "details");
```

## Next Steps (Future Enhancements)

1. **Real-time Cursor Tracking**: Show where other users are editing
2. **Voice/Video Chat**: Integrated communication
3. **Change Suggestions**: Propose changes for review
4. **Version History**: Track and revert to previous versions
5. **Advanced Notifications**: Email notifications, browser push notifications
6. **Mentions**: @mention users in comments
7. **Reactions**: Emoji reactions to comments

## Testing

To test the collaboration features:

1. Open the app in multiple browser windows/tabs
2. Log in as different users (or use incognito mode)
3. Navigate to the same project
4. Observe:
   - User presence indicators
   - Real-time activity feed
   - Lock indicators when editing
   - Notifications when locks change
   - Comments appearing in real-time

