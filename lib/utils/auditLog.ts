/**
 * Audit Log Utility
 * Tracks user actions for compliance, accountability, and debugging
 */

import { createDocument } from "@/lib/firebase/firestore";
import { User } from "firebase/auth";

export type AuditAction = 
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'EXPORT'
  | 'IMPORT'
  | 'LOGIN'
  | 'LOGOUT'
  | 'VIEW'
  | 'APPROVE'
  | 'REJECT';

export type AuditEntityType =
  | 'PROJECT'
  | 'ESTIMATE_LINE'
  | 'SETTINGS'
  | 'USER'
  | 'EXPORT'
  | 'IMPORT'
  | 'ADDRESS_BOOK'
  | 'BID_SCHEDULE'
  | 'REPORT';

export interface AuditLogChange {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface AuditLog {
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
  description?: string; // Human-readable description
}

/**
 * Extract user info from Firebase User object
 */
export function getUserInfoFromAuth(user: User | null): {
  userId: string;
  userName: string;
  userEmail?: string;
} {
  if (user) {
    return {
      userId: user.uid,
      userName: user.displayName || user.email?.split('@')[0] || 'Unknown User',
      userEmail: user.email || undefined,
    };
  }
  
  // Fallback for when user not available
  return {
    userId: 'system',
    userName: 'System',
  };
}

/**
 * Create an audit log entry
 * This is the main function to call when logging actions
 * 
 * @param companyId - The company ID
 * @param action - The action being performed
 * @param entityType - The type of entity being acted upon
 * @param entityId - The ID of the entity
 * @param user - Firebase User object (optional, will use 'system' if not provided)
 * @param options - Additional options for the audit log
 */
export async function createAuditLog(
  companyId: string,
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: string,
  user: User | null = null,
  options: {
    projectId?: string;
    entityName?: string;
    changes?: AuditLogChange[];
    metadata?: Record<string, any>;
    description?: string;
  } = {}
): Promise<void> {
  try {
    // Get user info from Firebase User object or use provided/defaults
    const userInfo = getUserInfoFromAuth(user);

    // Get client-side metadata if available
    const metadata: Record<string, any> = {
      ...options.metadata,
    };

    // Try to get browser info (client-side only)
    if (typeof window !== 'undefined') {
      metadata.userAgent = navigator.userAgent;
      // Note: IP address would need to be fetched from an API service
    }

    const auditLog: Omit<AuditLog, 'id'> = {
      timestamp: new Date(),
      userId: userInfo.userId,
      userName: userInfo.userName,
      userEmail: userInfo.userEmail,
      companyId,
      projectId: options.projectId,
      action,
      entityType,
      entityId,
      entityName: options.entityName,
      changes: options.changes,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      description: options.description || generateDescription(action, entityType, options.entityName),
    };

    // Save to Firestore
    const auditLogPath = `companies/${companyId}/auditLogs`;
    await createDocument(auditLogPath, auditLog);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Audit Log]', auditLog);
    }
  } catch (error) {
    // Don't throw errors - audit logging should never break the app
    console.error('Failed to create audit log:', error);
  }
}

/**
 * Generate a human-readable description for the audit log
 */
function generateDescription(
  action: AuditAction,
  entityType: AuditEntityType,
  entityName?: string
): string {
  const entityDisplayName = entityName || entityType.toLowerCase().replace('_', ' ');
  
  switch (action) {
    case 'CREATE':
      return `Created ${entityDisplayName}`;
    case 'UPDATE':
      return `Updated ${entityDisplayName}`;
    case 'DELETE':
      return `Deleted ${entityDisplayName}`;
    case 'EXPORT':
      return `Exported ${entityDisplayName}`;
    case 'IMPORT':
      return `Imported ${entityDisplayName}`;
    case 'VIEW':
      return `Viewed ${entityDisplayName}`;
    case 'APPROVE':
      return `Approved ${entityDisplayName}`;
    case 'REJECT':
      return `Rejected ${entityDisplayName}`;
    default:
      return `${action} ${entityDisplayName}`;
  }
}

/**
 * Helper to create audit log changes from before/after objects
 */
export function createAuditChanges<T extends Record<string, any>>(
  before: Partial<T>,
  after: Partial<T>,
  fieldsToTrack?: (keyof T)[]
): AuditLogChange[] {
  const changes: AuditLogChange[] = [];
  const fields = fieldsToTrack || Object.keys(after) as (keyof T)[];

  for (const field of fields) {
    const oldValue = before[field];
    const newValue = after[field];

    // Only log if value actually changed
    if (oldValue !== newValue) {
      // Handle deep equality for objects/arrays
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          field: String(field),
          oldValue: oldValue !== undefined ? oldValue : null,
          newValue: newValue !== undefined ? newValue : null,
        });
      }
    }
  }

  return changes;
}

/**
 * Format audit log for display
 */
export function formatAuditLogForDisplay(log: AuditLog): string {
  const time = new Date(log.timestamp).toLocaleString();
  const changes = log.changes && log.changes.length > 0
    ? ` (${log.changes.length} change${log.changes.length > 1 ? 's' : ''})`
    : '';
  
  return `${log.userName} ${log.description || log.action}${changes}`;
}

