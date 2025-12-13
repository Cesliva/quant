import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { useCompanyId } from "./useCompanyId";
import { getDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { UserRole, canAccessSettings, canManageUsers, ROLE_CONFIG } from "@/lib/types/roles";

interface UserPermissions {
  canCreateProjects: boolean;
  canEditProjects: boolean;
  canDeleteProjects: boolean;
  canViewReports: boolean;
  canManageUsers: boolean;
  canAccessSettings: boolean;
  role: UserRole;
  isOwner: boolean;
  isAdmin: boolean;
  isMember: boolean;
}

const DEFAULT_PERMISSIONS: UserPermissions = {
  canCreateProjects: false,
  canEditProjects: false,
  canDeleteProjects: false,
  canViewReports: true,
  canManageUsers: false,
  canAccessSettings: false,
  role: "member",
  isOwner: false,
  isAdmin: false,
  isMember: true,
};

/**
 * Map legacy roles to new role system
 * Handles backward compatibility with existing data
 */
function mapLegacyRole(legacyRole: string | undefined, isOwner: boolean): UserRole {
  if (isOwner) return "owner";
  
  // Map legacy roles
  if (legacyRole === "admin") return "admin";
  if (legacyRole === "estimator") return "member";
  if (legacyRole === "viewer") return "member";
  
  // Default to member
  return "member";
}

export function useUserPermissions() {
  const { user } = useAuth();
  const companyId = useCompanyId();
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);

  // Development bypass - give admin permissions
  const bypassAuth = process.env.NEXT_PUBLIC_BYPASS_AUTH === "true" && process.env.NODE_ENV === "development";

  useEffect(() => {
    // In bypass mode, give full owner permissions
    if (bypassAuth) {
      setPermissions({
        canCreateProjects: true,
        canEditProjects: true,
        canDeleteProjects: true,
        canViewReports: true,
        canManageUsers: true,
        canAccessSettings: true,
        role: "owner",
        isOwner: true,
        isAdmin: false,
        isMember: false,
      });
      setLoading(false);
      return;
    }

    if (!user || !companyId || !isFirebaseConfigured()) {
      setPermissions(DEFAULT_PERMISSIONS);
      setLoading(false);
      return;
    }

    const loadPermissions = async () => {
      try {
        const memberPath = `companies/${companyId}/members/${user.uid}`;
        const member = await getDocument(memberPath);
        
        // Check if user is workspace owner
        const companyPath = `companies/${companyId}`;
        const company = await getDocument<{ ownerId?: string }>(companyPath);
        const isOwner = company?.ownerId === user.uid;
        
        if (member) {
          // Map legacy role to new role system
          const role = mapLegacyRole(member.role, isOwner);
          const roleConfig = ROLE_CONFIG[role];
          
          setPermissions({
            canCreateProjects: member.permissions?.canCreateProjects ?? (role !== "member"),
            canEditProjects: member.permissions?.canEditProjects ?? (role !== "member"),
            canDeleteProjects: member.permissions?.canDeleteProjects ?? (role === "owner"),
            canViewReports: member.permissions?.canViewReports ?? true,
            canManageUsers: canManageUsers(role),
            canAccessSettings: canAccessSettings(role),
            role,
            isOwner,
            isAdmin: role === "admin",
            isMember: role === "member",
          });
        } else {
          // User is not a member document, but check if they're the workspace owner
          if (isOwner) {
            // User is workspace owner but member doc is missing - grant owner permissions
            setPermissions({
              canCreateProjects: true,
              canEditProjects: true,
              canDeleteProjects: true,
              canViewReports: true,
              canManageUsers: true,
              canAccessSettings: true,
              role: "owner",
              isOwner: true,
              isAdmin: false,
              isMember: false,
            });
          } else {
            // User is not a member and not owner - set default member permissions
            setPermissions(DEFAULT_PERMISSIONS);
          }
        }
      } catch (error) {
        console.error("Failed to load permissions:", error);
        setPermissions(DEFAULT_PERMISSIONS);
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, [user, companyId, bypassAuth]);

  return { permissions, loading };
}

