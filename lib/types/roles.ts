/**
 * Enterprise role system for Quant
 * 
 * Roles are human-readable and designed to feel intentional, safe, and premium.
 * This is not an internal hack - it must feel like enterprise SaaS.
 */

export type UserRole = "owner" | "admin" | "member";

export interface RoleConfig {
  label: string;
  description: string;
  canAccessSettings: boolean;
  canManageUsers: boolean;
  canTransferOwnership: boolean;
  canDeleteWorkspace: boolean;
}

export const ROLE_CONFIG: Record<UserRole, RoleConfig> = {
  owner: {
    label: "Workspace Owner",
    description: "Full control, billing authority, irreversible actions",
    canAccessSettings: true,
    canManageUsers: true,
    canTransferOwnership: true,
    canDeleteWorkspace: true,
  },
  admin: {
    label: "Workspace Administrator",
    description: "Manages settings and members, no ownership transfer",
    canAccessSettings: true,
    canManageUsers: true,
    canTransferOwnership: false,
    canDeleteWorkspace: false,
  },
  member: {
    label: "Member",
    description: "Core estimating functionality only",
    canAccessSettings: false,
    canManageUsers: false,
    canTransferOwnership: false,
    canDeleteWorkspace: false,
  },
};

/**
 * Get human-readable role label
 */
export function getRoleLabel(role: UserRole): string {
  return ROLE_CONFIG[role].label;
}

/**
 * Check if user can access settings
 */
export function canAccessSettings(role: UserRole): boolean {
  return ROLE_CONFIG[role].canAccessSettings;
}

/**
 * Check if user can manage other users
 */
export function canManageUsers(role: UserRole): boolean {
  return ROLE_CONFIG[role].canManageUsers;
}

/**
 * Check if user can transfer workspace ownership
 */
export function canTransferOwnership(role: UserRole): boolean {
  return ROLE_CONFIG[role].canTransferOwnership;
}


