"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Users, UserPlus, UserCheck } from "lucide-react";
import { subscribeToCollection, updateDocument, getDocument } from "@/lib/firebase/firestore";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { useUserPermissions } from "@/lib/hooks/useUserPermissions";
import { useAuth } from "@/lib/hooks/useAuth";
import { isFirebaseConfigured } from "@/lib/firebase/config";

interface ProjectAssignmentProps {
  projectId: string;
}

interface Member {
  id: string;
  userId: string;
  email: string;
  name?: string;
  role: "admin" | "estimator" | "viewer";
}

export function ProjectAssignment({ projectId }: ProjectAssignmentProps) {
  const companyId = useCompanyId();
  const { permissions } = useUserPermissions();
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [assignedEstimator, setAssignedEstimator] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId || !projectId) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        // Load project assignment
        const projectPath = `companies/${companyId}/projects/${projectId}`;
        const project = await getDocument(projectPath);
        
        if (project) {
          setAssignedTo(project.assignedTo || []);
          setAssignedEstimator(project.assignedEstimator || null);
        }

        // Load all company members
        const membersPath = `companies/${companyId}/members`;
        const unsubscribe = subscribeToCollection<Member>(
          membersPath,
          (data) => {
            setMembers(data);
            setLoading(false);
          }
        );

        return () => unsubscribe();
      } catch (error) {
        console.error("Failed to load assignment data:", error);
        setLoading(false);
      }
    };

    loadData();
  }, [companyId, projectId]);

  const handleAssign = async (userId: string) => {
    if (!permissions.canManageUsers && permissions.role !== "admin") {
      alert("Only admins can assign projects");
      return;
    }

    setIsSaving(true);
    try {
      const projectPath = `companies/${companyId}/projects/${projectId}`;
      const currentAssigned = assignedTo.includes(userId)
        ? assignedTo.filter(id => id !== userId)
        : [...assignedTo, userId];
      
      // Set primary estimator (first in list, or null if empty)
      const primaryEstimator = currentAssigned.length > 0 ? currentAssigned[0] : null;
      
      await updateDocument(`companies/${companyId}/projects`, projectId, {
        assignedTo: currentAssigned,
        assignedEstimator: primaryEstimator,
      });
      
      setAssignedTo(currentAssigned);
      setAssignedEstimator(primaryEstimator);
    } catch (error) {
      console.error("Failed to assign project:", error);
      alert("Failed to assign project");
    } finally {
      setIsSaving(false);
    }
  };

  // Only show to admins
  if (permissions.role !== "admin" && !permissions.canManageUsers) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Project Assignment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  const estimatorMembers = members.filter(
    m => (m.role === "estimator" || m.role === "admin") && m.userId !== user?.uid
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Project Assignment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {assignedEstimator && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                Primary Estimator: {members.find(m => m.userId === assignedEstimator)?.name || "Unknown"}
              </span>
            </div>
          </div>
        )}

        {estimatorMembers.length === 0 ? (
          <p className="text-sm text-gray-500">
            No estimators available. Invite team members from Settings → Users.
          </p>
        ) : (
          <div className="space-y-2">
            {estimatorMembers.map(member => {
              const isAssigned = assignedTo.includes(member.userId);
              return (
                <div
                  key={member.id}
                  className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                    isAssigned
                      ? "bg-blue-50 border-blue-200"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {member.name || member.email}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {member.role}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={isAssigned ? "primary" : "outline"}
                    onClick={() => handleAssign(member.userId)}
                    disabled={isSaving}
                    className="flex items-center gap-2"
                  >
                    {isAssigned ? (
                      <>
                        <UserCheck className="w-4 h-4" />
                        Assigned
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Assign
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {assignedTo.length > 0 && (
          <div className="pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-2">
              {assignedTo.length} {assignedTo.length === 1 ? "person" : "people"} assigned to this project
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

