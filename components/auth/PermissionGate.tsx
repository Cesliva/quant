"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Shield } from "lucide-react";
import { useUserPermissions } from "@/lib/hooks/useUserPermissions";

interface PermissionGateProps {
  children: ReactNode;
  requireSettingsAccess?: boolean;
  requireAdmin?: boolean;
  requireOwner?: boolean;
  fallback?: ReactNode;
}

/**
 * Permission Gate Component
 * 
 * Soft gate (UX) - shows calm, centered panel if user lacks permission
 * No blame, no error language. Just clear, professional messaging.
 */
export function PermissionGate({
  children,
  requireSettingsAccess = false,
  requireAdmin = false,
  requireOwner = false,
  fallback,
}: PermissionGateProps) {
  const { permissions, loading } = useUserPermissions();
  const router = useRouter();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Check permissions
  let hasAccess = true;

  if (requireOwner && !permissions.isOwner) {
    hasAccess = false;
  } else if (requireAdmin && !permissions.isAdmin && !permissions.isOwner) {
    hasAccess = false;
  } else if (requireSettingsAccess && !permissions.canAccessSettings) {
    hasAccess = false;
  }

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-gray-200 shadow-sm">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <Shield className="w-6 h-6 text-gray-400" />
              </div>
            </div>
            <CardTitle className="text-lg font-medium text-gray-900">
              Restricted Area
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-center">
            <p className="text-gray-600 text-sm leading-relaxed">
              Company settings are managed by workspace administrators.
            </p>
            <p className="text-xs text-gray-500">
              If you need access, contact your workspace owner.
            </p>
            <div className="pt-4">
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard")}
                className="min-w-[120px]"
              >
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}


