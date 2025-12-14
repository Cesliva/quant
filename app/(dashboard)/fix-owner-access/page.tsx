"use client";

import { useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { getDocument, updateDocument, setDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import Button from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Shield, CheckCircle, AlertCircle } from "lucide-react";

export default function FixOwnerAccessPage() {
  const { user } = useAuth();
  const companyId = useCompanyId();
  const [status, setStatus] = useState<"idle" | "checking" | "fixing" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [currentState, setCurrentState] = useState<{
    hasOwnerId: boolean;
    isOwner: boolean;
    hasMemberDoc: boolean;
    memberRole: string | null;
  } | null>(null);

  const checkCurrentState = async () => {
    if (!isFirebaseConfigured() || !user || !companyId) {
      setMessage("Firebase not configured or user not signed in");
      return;
    }

    setStatus("checking");
    setMessage("Checking current permissions...");

    try {
      // Check company document
      const company = await getDocument<{ ownerId?: string }>(`companies/${companyId}`);
      const hasOwnerId = !!company?.ownerId;
      const isOwner = company?.ownerId === user.uid;

      // Check member document
      const member = await getDocument(`companies/${companyId}/members/${user.uid}`);
      const hasMemberDoc = !!member;
      const memberRole = member?.role || null;

      setCurrentState({
        hasOwnerId,
        isOwner,
        hasMemberDoc,
        memberRole,
      });

      if (isOwner && hasMemberDoc && memberRole === "owner") {
        setStatus("success");
        setMessage("✅ You already have owner access! Refresh the page to see changes.");
      } else {
        setStatus("idle");
        setMessage("Ready to fix. Click 'Fix Owner Access' below.");
      }
    } catch (error: any) {
      setStatus("error");
      setMessage(`Error checking state: ${error.message}`);
    }
  };

  const fixOwnerAccess = async () => {
    if (!isFirebaseConfigured() || !user || !companyId) {
      setMessage("Firebase not configured or user not signed in");
      return;
    }

    setStatus("fixing");
    setMessage("Fixing owner access...");

    try {
      // 1. Set ownerId in company document
      await updateDocument("companies", companyId, {
        ownerId: user.uid,
      });
      setMessage("✅ Set ownerId in company document...");

      // 2. Create/update member document with owner role
      const memberPath = `companies/${companyId}/members/${user.uid}`;
      const existingMember = await getDocument(memberPath);

      const memberData = {
        userId: user.uid,
        email: user.email || "",
        name: user.displayName || user.email || "User",
        role: "owner",
        permissions: {
          canCreateProjects: true,
          canEditProjects: true,
          canDeleteProjects: true,
          canViewReports: true,
          canManageUsers: true,
          canAccessSettings: true,
        },
        status: "active",
        joinedAt: existingMember?.joinedAt || new Date(),
      };

      if (existingMember) {
        await updateDocument(`companies/${companyId}/members`, user.uid, memberData);
      } else {
        await setDocument(memberPath, memberData, false);
      }

      setStatus("success");
      setMessage("✅ Owner access fixed! Refresh the page to see changes.");
    } catch (error: any) {
      setStatus("error");
      setMessage(`Error fixing access: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Fix Owner Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              This page helps you fix owner access if you're the first user but don't have admin privileges.
              You don't need to sign up again.
            </p>
          </div>

          {!user && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                Please sign in first to use this tool.
              </p>
            </div>
          )}

          {user && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Your Information:</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>User ID: <code className="bg-gray-200 px-1 rounded">{user.uid}</code></li>
                  <li>Email: {user.email}</li>
                  <li>Company ID: <code className="bg-gray-200 px-1 rounded">{companyId}</code></li>
                </ul>
              </div>

              {currentState && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Current State:</p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li className="flex items-center gap-2">
                      {currentState.hasOwnerId ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      )}
                      Company has ownerId: {currentState.hasOwnerId ? "Yes" : "No"}
                    </li>
                    <li className="flex items-center gap-2">
                      {currentState.isOwner ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      )}
                      You are owner: {currentState.isOwner ? "Yes" : "No"}
                    </li>
                    <li className="flex items-center gap-2">
                      {currentState.hasMemberDoc ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      )}
                      Member document exists: {currentState.hasMemberDoc ? "Yes" : "No"}
                    </li>
                    <li>
                      Member role: <code className="bg-gray-200 px-1 rounded">{currentState.memberRole || "None"}</code>
                    </li>
                  </ul>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={checkCurrentState}
                  disabled={status === "checking" || status === "fixing"}
                >
                  Check Current State
                </Button>
                <Button
                  variant="primary"
                  onClick={fixOwnerAccess}
                  disabled={status === "checking" || status === "fixing"}
                >
                  {status === "fixing" ? "Fixing..." : "Fix Owner Access"}
                </Button>
              </div>

              {message && (
                <div
                  className={`rounded-lg p-4 ${
                    status === "success"
                      ? "bg-green-50 border border-green-200 text-green-800"
                      : status === "error"
                      ? "bg-red-50 border border-red-200 text-red-800"
                      : "bg-gray-50 border border-gray-200 text-gray-800"
                  }`}
                >
                  <p className="text-sm">{message}</p>
                </div>
              )}

              {status === "success" && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 font-medium mb-2">Next Steps:</p>
                  <ol className="text-sm text-blue-700 list-decimal list-inside space-y-1">
                    <li>Refresh this page or navigate to Settings</li>
                    <li>You should now see "Company Settings" in the sidebar</li>
                    <li>You should have full owner access</li>
                  </ol>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


