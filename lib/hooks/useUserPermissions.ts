import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { useCompanyId } from "./useCompanyId";
import { getDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";

interface UserPermissions {
  canCreateProjects: boolean;
  canEditProjects: boolean;
  canDeleteProjects: boolean;
  canViewReports: boolean;
  canManageUsers: boolean;
  canAccessSettings?: boolean; // New: controls access to company settings
  role: "admin" | "estimator" | "viewer";
}

const DEFAULT_PERMISSIONS: UserPermissions = {
  canCreateProjects: false,
  canEditProjects: false,
  canDeleteProjects: false,
  canViewReports: true,
  canManageUsers: false,
  canAccessSettings: false,
  role: "viewer",
};

export function useUserPermissions() {
  const { user } = useAuth();
  const companyId = useCompanyId();
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);

  // Development bypass - give admin permissions
  const bypassAuth = process.env.NEXT_PUBLIC_BYPASS_AUTH === "true" && process.env.NODE_ENV === "development";

  useEffect(() => {
    // In bypass mode, give full admin permissions
    if (bypassAuth) {
      setPermissions({
        canCreateProjects: true,
        canEditProjects: true,
        canDeleteProjects: true,
        canViewReports: true,
        canManageUsers: true,
        canAccessSettings: true,
        role: "admin",
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
        
        // Also check company license type
        const companyPath = `companies/${companyId}`;
        const company = await getDocument<{ licenseType?: "single-user" | "multi-user" }>(companyPath);
        
        if (member) {
          const licenseType = company?.licenseType;
          const isSingleUser = licenseType === "single-user";
          const isMultiUser = licenseType === "multi-user";
          
          // For single-user licenses: user has full access including settings
          // For multi-user licenses: only admins can access settings
          const canAccessSettings = isSingleUser 
            ? true 
            : isMultiUser 
            ? (member.role === "admin")
            : member.permissions?.canAccessSettings ?? true; // Default: allow for backward compatibility
          
          setPermissions({
            canCreateProjects: member.permissions?.canCreateProjects ?? false,
            canEditProjects: member.permissions?.canEditProjects ?? false,
            canDeleteProjects: member.permissions?.canDeleteProjects ?? false,
            canViewReports: member.permissions?.canViewReports ?? true,
            canManageUsers: member.permissions?.canManageUsers ?? false,
            canAccessSettings, // Add this new permission
            role: (member.role || "viewer") as "admin" | "estimator" | "viewer",
          });
        } else {
          // User is not a member - set default viewer permissions
          setPermissions(DEFAULT_PERMISSIONS);
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

