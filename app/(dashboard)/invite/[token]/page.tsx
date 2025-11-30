"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { CheckCircle, XCircle, Loader } from "lucide-react";
import { getDocument, queryDocuments, updateDocument, setDocument } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { where } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/config";

export default function InviteAcceptancePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const token = params.token as string;
  
  const [invitation, setInvitation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
    name: "",
  });

  useEffect(() => {
    if (!token) {
      setError("Invalid invitation link");
      setLoading(false);
      return;
    }

    loadInvitation();
  }, [token]);

  const loadInvitation = async () => {
    try {
      // Find invitation by token
      // Search across all companies
      const { query, collection, getDocs, where: whereClause } = await import("firebase/firestore");
      const { db, isFirebaseConfigured } = await import("@/lib/firebase/config");
      
      if (!isFirebaseConfigured() || !db) {
        setError("Firebase not configured");
        setLoading(false);
        return;
      }

      // Get all companies
      const companiesSnapshot = await getDocs(collection(db, "companies"));
      
      for (const companyDoc of companiesSnapshot.docs) {
        try {
          const invitationsRef = collection(db, `companies/${companyDoc.id}/invitations`);
          const invitationsQuery = query(invitationsRef, whereClause("invitationToken", "==", token));
          const invitationsSnapshot = await getDocs(invitationsQuery);
          
          if (!invitationsSnapshot.empty) {
            const docData = invitationsSnapshot.docs[0].data() as { status?: string; expiresAt?: any; [key: string]: any };
            const inv = { id: invitationsSnapshot.docs[0].id, ...docData };
            
            if (inv.status === "accepted") {
              setError("This invitation has already been accepted");
              setLoading(false);
              return;
            }
            
            if (inv.expiresAt) {
              const expiresAt = inv.expiresAt.toDate ? inv.expiresAt.toDate() : new Date(inv.expiresAt);
              if (expiresAt < new Date()) {
                setError("This invitation has expired");
                setLoading(false);
                return;
              }
            }
            
            setInvitation({ ...inv, companyId: companyDoc.id });
            setLoading(false);
            return;
          }
        } catch (err) {
          // Continue searching
          console.warn(`Error checking company ${companyDoc.id}:`, err);
        }
      }
      
      setError("Invitation not found");
      setLoading(false);
    } catch (error: any) {
      console.error("Failed to load invitation:", error);
      setError("Failed to load invitation");
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.password || formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsAccepting(true);
    setError(null);

    try {
      if (!invitation || !auth) {
        throw new Error("Invalid invitation or authentication not configured");
      }

      // Create user account
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        invitation.email,
        formData.password
      );

      const newUser = userCredential.user;

      // Update user profile
      if (formData.name) {
        // Update Firebase Auth profile
        // Note: This requires additional Firebase Auth methods
      }

      // Create member document
      const memberPath = `companies/${invitation.companyId}/members/${newUser.uid}`;
      await setDocument(
        memberPath,
        {
          userId: newUser.uid,
          email: invitation.email,
          name: formData.name || invitation.email,
          role: invitation.role,
          permissions: getRolePermissions(invitation.role),
          status: "active",
          joinedAt: new Date(),
        },
        false
      );

      // Mark invitation as accepted
      await updateDocument(
        `companies/${invitation.companyId}/invitations`,
        invitation.id,
        {
          status: "accepted",
          acceptedAt: new Date(),
          acceptedBy: newUser.uid,
        }
      );

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Failed to accept invitation:", error);
      setError(error.message || "Failed to accept invitation");
    } finally {
      setIsAccepting(false);
    }
  };

  const getRolePermissions = (role: string) => {
    const permissions: Record<string, any> = {
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
    return permissions[role] || permissions.viewer;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Invitation</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button variant="outline" onClick={() => router.push("/dashboard")}>
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-center">Accept Invitation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center mb-6">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-600">
              You&apos;ve been invited to join as a <strong>{invitation?.role}</strong>
            </p>
            <p className="text-sm text-gray-500 mt-2">{invitation?.email}</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleAcceptInvitation} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Your full name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Create a password (min 6 characters)"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <Input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Confirm your password"
                required
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={isAccepting}
            >
              {isAccepting ? "Creating Account..." : "Accept Invitation & Create Account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

