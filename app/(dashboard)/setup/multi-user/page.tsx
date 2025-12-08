"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { getDocument, updateDocument } from "@/lib/firebase/firestore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Building2, Users, Shield, CheckCircle2, AlertCircle } from "lucide-react";
import { QLoader } from "@/components/ui/QLoader";

export default function MultiUserSetupPage() {
  const router = useRouter();
  const { user } = useAuth();
  const companyId = useCompanyId();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState<{
    companyName?: string;
    licenseType?: string;
    needsSetup?: boolean;
  } | null>(null);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    adminEmail: "",
    adminName: "",
  });

  useEffect(() => {
    const loadCompany = async () => {
      if (!companyId || companyId === "default") {
        router.push("/dashboard");
        return;
      }

      try {
        const companyData = await getDocument(`companies/${companyId}`);
        if (!companyData) {
          router.push("/dashboard");
          return;
        }

        // Check if setup is needed
        if (!companyData.licenseType || companyData.licenseType !== "multi-user" || !companyData.needsSetup) {
          router.push("/dashboard");
          return;
        }

        setCompany(companyData);
        setFormData({
          adminEmail: user?.email || "",
          adminName: user?.displayName || "",
        });
      } catch (error) {
        console.error("Failed to load company:", error);
        router.push("/dashboard");
      } finally {
        setLoading(false);
      }
    };

    loadCompany();
  }, [companyId, user, router]);

  const handleCompleteSetup = async () => {
    if (!formData.adminEmail || !formData.adminName) {
      alert("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      // Mark setup as complete
      await updateDocument("companies", companyId, {
        needsSetup: false,
        setupCompletedAt: new Date(),
      });

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Failed to complete setup:", error);
      alert("Failed to complete setup. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <QLoader size={48} />
          <p className="mt-4 text-slate-600">Loading setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Multi-User License Setup</h1>
          <p className="text-slate-600">
            Configure your multi-user license and set up administrator access
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-purple-600" />
              License Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-blue-900 mb-1">Multi-User License Active</p>
                  <p className="text-sm text-blue-800">
                    With a multi-user license, only administrators can access Company Settings. 
                    Regular users will have access to projects and estimating features, but settings 
                    management is restricted to admins only.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Building2 className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Company</p>
                  <p className="text-sm text-gray-600">{company?.companyName || "Unknown"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Users className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">License Type</p>
                  <p className="text-sm text-gray-600">Multi-User</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Administrator Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>You are the primary administrator</strong> for this multi-user license. 
                You can invite additional users and assign admin roles to them through Settings → Users.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Administrator Name
              </label>
              <Input
                value={formData.adminName}
                onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Administrator Email
              </label>
              <Input
                type="email"
                value={formData.adminEmail}
                onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                placeholder="your@email.com"
              />
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">What's Next?</h3>
              <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                <li>You can invite team members from Settings → Users</li>
                <li>Only administrators can access Company Settings</li>
                <li>Regular users can create projects and use estimating features</li>
                <li>You can promote users to admin role at any time</li>
              </ul>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="primary"
                onClick={handleCompleteSetup}
                disabled={saving || !formData.adminName || !formData.adminEmail}
                className="flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <QLoader size={18} />
                    Completing Setup...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Complete Setup
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard")}
                disabled={saving}
              >
                Skip for Now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

