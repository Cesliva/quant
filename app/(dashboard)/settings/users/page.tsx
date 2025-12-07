"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Plus, UserPlus, Trash2, Shield, User, Eye } from "lucide-react";
import { subscribeToCollection, createDocument, updateDocument, deleteDocument } from "@/lib/firebase/firestore";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { useAuth } from "@/lib/hooks/useAuth";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { getDocRef, setDocument } from "@/lib/firebase/firestore";
import { serverTimestamp } from "firebase/firestore";
import { AlertCircle, Crown } from "lucide-react";

interface Member {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: "admin" | "estimator" | "viewer";
  permissions?: {
    canCreateProjects: boolean;
    canEditProjects: boolean;
    canDeleteProjects: boolean;
    canViewReports: boolean;
    canManageUsers: boolean;
  };
  joinedAt?: any;
  lastActive?: any;
}

const ROLE_PERMISSIONS = {
  admin: {
    canCreateProjects: true,
    canEditProjects: true,
    canDeleteProjects: true,
    canViewReports: true,
    canManageUsers: true,
  },
  estimator: {
    canCreateProjects: true,
    canEditProjects: true,
    canDeleteProjects: false,
    canViewReports: true,
    canManageUsers: false,
  },
  viewer: {
    canCreateProjects: false,
    canEditProjects: false,
    canDeleteProjects: false,
    canViewReports: true,
    canManageUsers: false,
  },
};

export default function UsersManagementPage() {
  const companyId = useCompanyId();
  const { user: currentUser } = useAuth();
  const { subscription, currentSeats, maxSeats, canAddSeat, remainingSeats, loading: subscriptionLoading } = useSubscription();
  const [members, setMembers] = useState<Member[]>([]);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "estimator" | "viewer">("estimator");
  const [isInviting, setIsInviting] = useState(false);

  // Load members
  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId) {
      return;
    }

    const membersPath = `companies/${companyId}/members`;
    const unsubscribe = subscribeToCollection<Member>(
      membersPath,
      (data) => {
        setMembers(data);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  const handleInviteUser = async () => {
    if (!inviteEmail.trim()) {
      alert("Please enter an email address");
      return;
    }

    setIsInviting(true);
    try {
      // Call the invitation API
      const response = await fetch("/api/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          email: inviteEmail.trim(),
          role: inviteRole,
          invitedBy: currentUser?.uid,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle seat limit error specifically
        if (result.seatLimitReached) {
          alert(`Seat limit reached!\n\nYou have ${result.currentSeats} of ${result.maxSeats} seats used.\n\n${result.error}`);
        } else {
          throw new Error(result.error || "Failed to send invitation");
        }
        return;
      }

      if (result.emailSent) {
        alert(`Invitation email sent to ${inviteEmail}`);
      } else {
        alert(`Invitation created but email failed: ${result.emailError || "Unknown error"}\n\nInvite link: ${result.inviteLink}`);
      }

      setInviteEmail("");
      setShowInviteForm(false);
    } catch (error: any) {
      console.error("Failed to invite user:", error);
      alert(`Failed to invite user: ${error.message}`);
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: "admin" | "estimator" | "viewer") => {
    try {
      await updateDocument(
        `companies/${companyId}/members`,
        memberId,
        {
          role: newRole,
          permissions: ROLE_PERMISSIONS[newRole],
        }
      );
    } catch (error: any) {
      console.error("Failed to update role:", error);
      alert(`Failed to update role: ${error.message}`);
    }
  };

  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    if (!confirm(`Are you sure you want to remove ${memberEmail} from the team?`)) {
      return;
    }

    try {
      await deleteDocument(`companies/${companyId}/members`, memberId);
    } catch (error: any) {
      console.error("Failed to remove member:", error);
      alert(`Failed to remove member: ${error.message}`);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Shield className="w-4 h-4 text-purple-600" />;
      case "estimator":
        return <User className="w-4 h-4 text-blue-600" />;
      case "viewer":
        return <Eye className="w-4 h-4 text-gray-600" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "estimator":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "viewer":
        return "bg-gray-100 text-gray-700 border-gray-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const canManageUsers = members.find(
    (m) => m.userId === currentUser?.uid
  )?.permissions?.canManageUsers;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Team Members</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage who has access to your company&apos;s projects
          </p>
          {!subscriptionLoading && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">
                {subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} Plan
              </span>
              <span className="text-xs text-gray-400">•</span>
              <span className={`text-xs font-medium ${remainingSeats === 0 ? 'text-red-600' : remainingSeats <= 2 ? 'text-yellow-600' : 'text-gray-600'}`}>
                {currentSeats} of {maxSeats} seats used
                {remainingSeats > 0 && ` (${remainingSeats} remaining)`}
              </span>
            </div>
          )}
        </div>
        {canManageUsers && (
          <Button
            variant="primary"
            onClick={() => setShowInviteForm(!showInviteForm)}
            disabled={!canAddSeat}
            title={!canAddSeat ? `Seat limit reached. You have ${currentSeats} of ${maxSeats} seats used.` : ""}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Invite Member
          </Button>
        )}
      </div>

      {!canAddSeat && canManageUsers && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-800">
              Seat limit reached
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              You have reached your seat limit of {maxSeats} for the {subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} plan. 
              {subscription.plan !== "enterprise" && " Please upgrade your plan to invite more users."}
            </p>
          </div>
        </div>
      )}

      {showInviteForm && canManageUsers && (
        <Card>
          <CardHeader>
            <CardTitle>Invite New Member</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="viewer">Viewer - Can view projects and reports</option>
                <option value="estimator">Estimator - Can create and edit projects</option>
                <option value="admin">Admin - Full access including user management</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={handleInviteUser}
                disabled={isInviting}
              >
                {isInviting ? "Sending..." : "Send Invitation"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowInviteForm(false);
                  setInviteEmail("");
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Current Members ({members.length})</CardTitle>
            {!subscriptionLoading && (
              <div className="text-sm text-gray-500">
                {currentSeats} / {maxSeats} seats
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No members yet</p>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold">
                        {member.name?.[0]?.toUpperCase() || member.email[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {member.name || member.email}
                        </span>
                        {member.userId === currentUser?.uid && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{member.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium ${getRoleBadgeColor(
                          member.role
                        )}`}
                      >
                        {getRoleIcon(member.role)}
                        {member.role}
                      </div>
                    </div>
                  </div>
                  {canManageUsers && member.userId !== currentUser?.uid && (
                    <div className="flex items-center gap-2">
                      <select
                        value={member.role}
                        onChange={(e) =>
                          handleUpdateRole(member.id, e.target.value as any)
                        }
                        className="text-sm px-2 py-1 border border-gray-300 rounded"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="estimator">Estimator</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={() => handleRemoveMember(member.id, member.email)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

