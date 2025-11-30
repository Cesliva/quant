# Project Assignment & Permission System

## Overview
This system implements role-based access control with project assignment functionality, allowing admins to control who can create projects and which estimators can access specific projects.

## Features Implemented

### 1. **User Permissions Hook**
- **File**: `lib/hooks/useUserPermissions.ts`
- Loads user permissions from Firestore based on their role
- Returns permissions object with:
  - `canCreateProjects`
  - `canEditProjects`
  - `canDeleteProjects`
  - `canViewReports`
  - `canManageUsers`
  - `role` (admin, estimator, viewer)

### 2. **Default Admin User**
- **File**: `lib/utils/createDefaultAdmin.ts`
- **Setup Page**: `app/(dashboard)/setup/admin/page.tsx`
- Creates default admin user for development:
  - **Email**: `admin@quant.com`
  - **Password**: `admin123`
- Navigate to `/setup/admin` to create the admin user

### 3. **Dashboard Updates**
- **File**: `app/page.tsx`
- **Changes**:
  - "New Project" button only shows if user has `canCreateProjects` permission
  - Project filter: "My Projects" / "All Projects" (admins see both)
  - Projects filtered by assignment:
    - Estimators/Viewers: Only see projects assigned to them
    - Admins: See all projects (or filtered by selection)

### 4. **Project Assignment Component**
- **File**: `components/projects/ProjectAssignment.tsx`
- **Location**: Project Details page (admin only)
- **Features**:
  - Lists all estimators in the company
  - Shows current assignment status
  - Allows admins to assign/unassign estimators
  - Shows primary estimator (first in list)
  - Updates `assignedTo` array and `assignedEstimator` field

### 5. **Firestore Security Rules**
- **File**: `firestore.rules`
- **Updates**:
  - `canReadProject()`: Checks if user is assigned or is admin
  - `hasProjectAccess()`: Enhanced to check `assignedEstimator` field
  - Project creation: Requires `canCreateProjects` permission
  - Project deletion: Requires `canDeleteProjects` permission

## How It Works

### User Roles & Permissions

#### Admin
- ✅ Can create projects
- ✅ Can edit all projects
- ✅ Can delete projects
- ✅ Can view all projects
- ✅ Can manage users
- ✅ Can assign projects to estimators

#### Estimator
- ✅ Can create projects (if permission enabled)
- ✅ Can edit assigned projects
- ❌ Cannot delete projects
- ✅ Can view assigned projects
- ❌ Cannot manage users

#### Viewer
- ❌ Cannot create projects
- ❌ Cannot edit projects
- ❌ Cannot delete projects
- ✅ Can view assigned projects (read-only)
- ❌ Cannot manage users

### Project Assignment Flow

1. **Admin creates project** (or estimator if allowed)
2. **Admin assigns project** via Project Assignment component
3. **Assigned estimators** can now:
   - See project on dashboard (if "My Projects" filter)
   - Access project details
   - Edit project data
   - Add line items
   - View reports

### Assignment Data Structure

```typescript
// Project document in Firestore
{
  projectName: "Project Name",
  assignedTo: ["userId1", "userId2"], // Array of assigned user IDs
  assignedEstimator: "userId1", // Primary estimator (first in array)
  // ... other project fields
}
```

## Setup Instructions

### 1. Create Your Account

1. Navigate to `/signup` in your browser
2. Fill in your details (name, company name, email, password)
3. Click "Create Account"
4. You'll automatically be set as admin of your company

### 2. Invite Team Members

1. Log in as admin
2. Go to Settings → Users
3. Invite estimators/viewers by email
4. Set their roles appropriately

### 3. Assign Projects

1. Create or open a project
2. Scroll to "Project Assignment" section (admin only)
3. Click "Assign" next to estimator names
4. First assigned person becomes primary estimator

## Testing

### Test Admin Access
1. Log in as `admin@quant.com` / `admin123`
2. Verify you can:
   - See "New Project" button
   - See all projects
   - Assign projects to estimators

### Test Estimator Access
1. Create an estimator account (via invitation)
2. Log in as estimator
3. Verify:
   - Can see "New Project" button (if permission enabled)
   - Only sees assigned projects on dashboard
   - Cannot assign projects (no assignment UI)

### Test Viewer Access
1. Create a viewer account
2. Log in as viewer
3. Verify:
   - Cannot see "New Project" button
   - Only sees assigned projects
   - Read-only access to projects

## Security Notes

⚠️ **Important**: The Firestore rules are currently in DEVELOPMENT MODE. Before production:

1. **Enable Production Rules**: Uncomment the production rules section in `firestore.rules`
2. **Deploy Rules**: Run `firebase deploy --only firestore:rules`
3. **Test Thoroughly**: Ensure all access patterns work correctly

## Future Enhancements

- [ ] Bulk project assignment
- [x] Assignment history/audit log (See `AUDIT_TRAIL_DOCUMENTATION.md` for details)
- [ ] Project templates with pre-assigned estimators
- [ ] Notification when assigned to a project
- [ ] Project request system (estimators request access)

## Related Documentation

- **Audit Trail System**: See `AUDIT_TRAIL_DOCUMENTATION.md` for comprehensive audit logging implementation

