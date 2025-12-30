"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { CheckCircle, XCircle, Loader, ArrowRight } from "lucide-react";
import { getDocument, updateDocument } from "@/lib/firebase/firestore";
import { getAuthErrorMessage } from "@/lib/utils/authErrors";
import { QMark } from "@/components/ui/QMark";

export default function BetaSignupPage() {
  const params = useParams();
  const router = useRouter();
  const { signUp } = useAuth();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    companyName: "",
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
      const { query, collection, getDocs, where: whereClause } = await import("firebase/firestore");
      const { db, isFirebaseConfigured } = await import("@/lib/firebase/config");

      if (!isFirebaseConfigured() || !db) {
        setError("Firebase not configured");
        setLoading(false);
        return;
      }

      const invitationsRef = collection(db, "betaInvitations");
      const invitationsQuery = query(invitationsRef, whereClause("invitationToken", "==", token));
      const invitationsSnapshot = await getDocs(invitationsQuery);

      if (invitationsSnapshot.empty) {
        setError("Invitation not found or invalid");
        setLoading(false);
        return;
      }

      const docData = invitationsSnapshot.docs[0].data() as {
        status?: string;
        expiresAt?: any;
        email?: string;
        name?: string;
        companyName?: string;
        [key: string]: any;
      };
      const inv = {
        id: invitationsSnapshot.docs[0].id,
        ...docData,
      };

      if (inv.status === "accepted") {
        setError("This invitation has already been used");
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

      // Pre-fill form with invitation data
      setFormData({
        name: inv.name || "",
        email: inv.email || "",
        password: "",
        confirmPassword: "",
        companyName: inv.companyName || "",
      });

      setInvitation(inv);
      setLoading(false);
    } catch (error: any) {
      console.error("Failed to load invitation:", error);
      setError("Failed to load invitation");
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name || !formData.email || !formData.password || !formData.companyName) {
      setError("Please fill in all required fields");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSigningUp(true);

    try {
      // Create account via signup API (no beta code or license needed - invitation handles access)
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          companyName: formData.companyName,
          // No beta code or license serial - invitation grants access
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create account");
      }

      // Mark invitation as accepted
      if (invitation?.id) {
        try {
          await updateDocument("betaInvitations", invitation.id, {
            status: "accepted",
            acceptedAt: new Date(),
            acceptedBy: data.userId,
          });
        } catch (err) {
          console.warn("Failed to update invitation status:", err);
          // Don't fail signup if this fails
        }
      }

      // Sign in the user
      await signUp(formData.email, formData.password);

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Failed to sign up:", err);
      // Convert Firebase errors to user-friendly messages
      setError(getAuthErrorMessage(err));
      setIsSigningUp(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Invitation</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button variant="outline" onClick={() => router.push("/login")}>
                Go to Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <QMark className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Create Your Account</h1>
          <p className="text-gray-600 mt-2">You've been invited to beta test Quant Steel</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
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
                  Email <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="your@email.com"
                  required
                  disabled={!!invitation?.email}
                />
                {invitation?.email && (
                  <p className="mt-1 text-xs text-gray-500">Email is pre-filled from invitation</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="Your company name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password <span className="text-red-500">*</span>
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
                  Confirm Password <span className="text-red-500">*</span>
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
                disabled={isSigningUp}
              >
                {isSigningUp ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin mr-2" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    Create Account & Start Testing
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <p className="mt-4 text-xs text-center text-gray-500">
              By creating an account, you agree to participate in the beta test program.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}







