# Audit Trail System Documentation

## Overview

The audit trail system provides comprehensive logging of user actions for compliance, accountability, debugging, and business intelligence. All critical actions are automatically tracked with user information, timestamps, and change details.

## Implementation Date

December 2024

## Architecture

### Core Components

1. **Audit Log Utility** (`lib/utils/auditLog.ts`)
   - Main logging functions and type definitions
   - Handles creation and formatting of audit log entries

2. **Recent Activity Component** (`components/dashboard/RecentActivity.tsx`)
   - Real-time activity feed widget
   - Displays on company dashboard

3. **Firestore Structure**
   ```
   companies/{companyId}/auditLogs/{logId}
   ```

## Data Model

### AuditLog Interface

```typescript
interface AuditLog {
  id?: string;
  timestamp: Date;
  userId: string;
  userName: string;
  userEmail?: string;
  companyId: string;
  projectId?: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityName?: string;
  changes?: AuditLogChange[];
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    exportType?: string;
    fileName?: string;
    fileSize?: number;
    [key: string]: any;
  };
  description?: string;
}
```

### Audit Actions

- `CREATE` - New entity created
- `UPDATE` - Entity modified
- `DELETE` - Entity removed
- `EXPORT` - Data exported
- `IMPORT` - Data imported
- `LOGIN` - User logged in
- `LOGOUT` - User logged out
- `VIEW` - Entity viewed
- `APPROVE` - Entity approved
- `REJECT` - Entity rejected

### Entity Types

- `PROJECT` - Project operations
- `ESTIMATE_LINE` - Estimate line items
- `SETTINGS` - Company/project settings
- `USER` - User management
- `EXPORT` - Export operations
- `IMPORT` - Import operations
- `ADDRESS_BOOK` - Contact management
- `BID_SCHEDULE` - Bid/production schedule
- `REPORT` - Report generation

## Current Implementation

### Logged Operations

#### 1. Estimate Line Operations
**Location:** `components/estimating/EstimatingGrid.tsx`

- **Create:** When new estimate lines are added
- **Update:** When estimate lines are modified (tracks: totalCost, materialCost, laborCost, coatingCost, rates, quantities, status, descriptions)
- **Delete:** When estimate lines are removed

**Example:**
```typescript
await createAuditLog(
  companyId,
  'UPDATE',
  'ESTIMATE_LINE',
  lineId,
  user,
  {
    projectId,
    entityName: line.itemDescription || lineId,
    changes: createAuditChanges(before, after, trackedFields),
  }
);
```

#### 2. Project Operations
**Location:** `app/(dashboard)/projects/[id]/details/page.tsx`

- **Create:** When new projects are created
- **Update:** When projects are modified (tracks: projectName, projectNumber, status, estimatedValue, bidDueDate, generalContractor, projectType)

#### 3. Settings Changes
**Location:** `app/(dashboard)/settings/page.tsx`

- **Update:** When company settings are saved (tracks: materialRate, laborRate, coatingRate, overheadPercentage, profitPercentage, waste factors)

#### 4. Export Operations
**Locations:**
- `components/estimating/EstimatingGrid.tsx` (CSV exports)
- `app/(dashboard)/reports/page.tsx` (PDF, Excel exports)
- `app/(dashboard)/projects/[id]/estimating/page.tsx` (Quant format)
- `app/(dashboard)/estimating/page.tsx` (Quant format)

- **Export:** Tracks export type, file name, line count, project

#### 5. Login Operations
**Location:** `app/(auth)/login/page.tsx`

- **Login:** Tracks user login events with company lookup

### Dashboard Integration

**Location:** `app/(dashboard)/dashboard/page.tsx`

- Recent Activity widget displays last 10 activities
- Real-time updates via Firestore subscriptions
- Shows user, action, timestamp, and change summary

## Usage

### Creating Audit Logs

```typescript
import { createAuditLog, createAuditChanges } from "@/lib/utils/auditLog";
import { useAuth } from "@/lib/hooks/useAuth";

// In your component
const { user } = useAuth();

// Simple log
await createAuditLog(
  companyId,
  'UPDATE',
  'ESTIMATE_LINE',
  entityId,
  user,
  {
    projectId: 'project123',
    entityName: 'Line Item Description',
  }
);

// Log with change tracking
const changes = createAuditChanges(beforeState, afterState, [
  'totalCost',
  'materialRate',
  'qty',
]);

await createAuditLog(
  companyId,
  'UPDATE',
  'ESTIMATE_LINE',
  entityId,
  user,
  {
    projectId: 'project123',
    entityName: 'Line Item',
    changes,
  }
);
```

### Displaying Audit Logs

```typescript
import RecentActivity from "@/components/dashboard/RecentActivity";

// Company-wide activity
<RecentActivity companyId={companyId} limit={10} />

// Project-specific activity
<RecentActivity companyId={companyId} projectId={projectId} limit={20} />
```

## Storage & Costs

### Firestore Structure
- Collection: `companies/{companyId}/auditLogs`
- Document size: ~1KB per log entry
- Estimated cost: ~$0.005/month per company (1000 actions/day)

### Retention Policy
- **Current:** No automatic deletion
- **Recommended:** 7 years for compliance
- **Future:** Archive old logs to cheaper storage

## Future Enhancements

### Phase 1: Enhanced Features (High Priority)
1. **Audit Log Export**
   - CSV export for compliance reports
   - PDF export with formatting
   - Date range filtering

2. **Dedicated Audit Log Page**
   - Full history view
   - Advanced filtering (user, date, action type, entity type)
   - Search functionality
   - Pagination

3. **Logout Tracking**
   - Add logout audit logging when logout is implemented

### Phase 2: Advanced Features (Medium Priority)
4. **Change Detail View**
   - Expandable change details in Recent Activity
   - Side-by-side before/after comparison
   - Visual diff highlighting

5. **Filtering & Search**
   - Filter by user, project, date range
   - Search by entity name or description
   - Save filter presets

6. **Alerts & Notifications**
   - Email alerts for critical changes
   - Real-time notifications for sensitive operations
   - Configurable alert rules

### Phase 3: Enterprise Features (Low Priority)
7. **Compliance Reports**
   - Automated compliance report generation
   - Scheduled exports
   - Custom report templates

8. **Data Retention Management**
   - Automatic archiving of old logs
   - Configurable retention policies
   - Export to cold storage

9. **Advanced Analytics**
   - Usage patterns dashboard
   - User activity heatmaps
   - Change frequency analysis
   - Audit trail health metrics

10. **Security Features**
    - Immutable logs (write-once)
    - Digital signatures
    - Tamper detection
    - Access control for audit logs

## Best Practices

1. **Always log critical financial changes**
   - Cost modifications
   - Rate changes
   - Markup adjustments

2. **Include meaningful entity names**
   - Use descriptive names (e.g., "Project ABC" not just "project123")
   - Helps with readability in audit logs

3. **Track relevant fields only**
   - Don't log every field change
   - Focus on business-critical fields
   - Use `createAuditChanges()` with field list

4. **Handle errors gracefully**
   - Audit logging should never break the app
   - Log errors to console in development
   - Fail silently in production (already implemented)

5. **Consider performance**
   - Batch audit logs if possible (future enhancement)
   - Use Firestore indexes for queries
   - Limit Recent Activity queries

## Troubleshooting

### Audit logs not appearing
1. Check Firebase configuration
2. Verify user authentication
3. Check browser console for errors
4. Verify Firestore rules allow writes to `auditLogs` collection

### Performance issues
1. Limit Recent Activity queries (use `limit` prop)
2. Add Firestore indexes for common queries
3. Consider pagination for large datasets

### Missing audit logs
1. Check if operation is integrated with audit logging
2. Verify `createAuditLog` is being called
3. Check error console for failed audit log attempts

## Firestore Security Rules

Ensure your Firestore rules allow audit log creation:

```javascript
match /companies/{companyId}/auditLogs/{logId} {
  allow read: if isCompanyMember(companyId);
  allow create: if isCompanyMember(companyId) && 
    request.resource.data.userId == request.auth.uid;
  allow update, delete: if false; // Audit logs are immutable
}
```

## Related Files

- `lib/utils/auditLog.ts` - Core audit logging utilities
- `components/dashboard/RecentActivity.tsx` - Activity feed component
- `components/estimating/EstimatingGrid.tsx` - Estimate line logging
- `app/(dashboard)/projects/[id]/details/page.tsx` - Project logging
- `app/(dashboard)/settings/page.tsx` - Settings logging
- `app/(dashboard)/reports/page.tsx` - Export logging
- `app/(auth)/login/page.tsx` - Login logging

## Notes

- Audit logs are designed to be immutable (no updates/deletes)
- All audit logging is asynchronous and non-blocking
- Development mode logs to console for debugging
- Production mode fails silently to prevent app disruption
- User information is extracted from Firebase Auth automatically

## Support

For questions or issues with the audit trail system, refer to this documentation or check the implementation in the files listed above.

