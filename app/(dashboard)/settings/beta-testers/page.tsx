"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { useUserPermissions } from "@/lib/hooks/useUserPermissions";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Mail, CheckCircle, Clock, XCircle, Plus } from "lucide-react";
import { queryDocuments, getDocument } from "@/lib/firebase/firestore";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase/config";

interface BetaInvitation {
  id: string;
  email: string;
  name?: string;
  companyName?: string;
  status: "pending" | "accepted" | "expired";
  createdAt: any;
  expiresAt: any;
  acceptedAt?: any;
  invitedBy?: string;
}

export default function BetaTestersPage() {
  const { user } = useAuth();
  const companyId = useCompanyId();
  const permissions = useUserPermissions();
  const [invitations, setInvitations] = useState<BetaInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    companyName: "",
  });

  useEffect(() => {
    if (isFirebaseConfigured() && db) {
      loadInvitations();
    }
  }, []);

  const loadInvitations = async () => {
    try {
      if (!isFirebaseConfigured() || !db) return;

      const invitationsRef = collection(db, "betaInvitations");
      const q = query(invitationsRef, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);

      const invites: BetaInvitation[] = [];
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
        const isExpired = expiresAt < new Date();
        
        invites.push({
          id: doc.id,
          email: data.email,
          name: data.name,
          companyName: data.companyName,
          status: isExpired ? "expired" : (data.status || "pending"),
          createdAt: data.createdAt,
          expiresAt: data.expiresAt,
          acceptedAt: data.acceptedAt,
          invitedBy: data.invitedBy,
        });
      });

      setInvitations(invites);
    } catch (error) {
      console.error("Failed to load invitations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    try {
      const response = await fetch("/api/beta-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name || undefined,
          companyName: formData.companyName || undefined,
          invitedBy: user?.uid,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send invitation");
      }

      // Reset form and reload
      setFormData({ email: "", name: "", companyName: "" });
      setShowForm(false);
      await loadInvitations();

      alert(data.emailSent 
        ? "Beta invitation sent successfully!" 
        : `Invitation created but email failed: ${data.emailError}\n\nInvite link: ${data.inviteLink}`);
    } catch (error: any) {
      alert(`Failed to send invitation: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "accepted":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "expired":
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-amber-600" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "accepted":
        return "Accepted";
      case "expired":
        return "Expired";
      default:
        return "Pending";
    }
  };

  return (
    <PermissionGate requireSettingsAccess>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Beta Tester Invitations</h1>
          <p className="text-gray-600 mt-2">
            Invite beta testers to try Quant Steel. They'll receive a professional invitation email with a signup link.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Send Beta Invitation</CardTitle>
              {!showForm && (
                <Button
                  variant="primary"
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Invitation
                </Button>
              )}
            </div>
          </CardHeader>
          {showForm && (
            <CardContent>
              <form onSubmit={handleSendInvitation} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="tester@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name (Optional)
                  </label>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Tester Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Suggested Company Name (Optional)
                  </label>
                  <Input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="Their Company Name"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    They can change this during signup
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={sending}
                  >
                    {sending ? "Sending..." : "Send Invitation"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setFormData({ email: "", name: "", companyName: "" });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invitation History</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500 text-center py-8">Loading...</p>
            ) : invitations.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No invitations sent yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Email</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Name</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Company</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((inv) => (
                      <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400" />
                            {inv.email}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-700">{inv.name || "-"}</td>
                        <td className="py-3 px-4 text-gray-700">{inv.companyName || "-"}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(inv.status)}
                            <span className="text-sm">{getStatusLabel(inv.status)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {inv.createdAt?.toDate
                            ? inv.createdAt.toDate().toLocaleDateString()
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  );
}


