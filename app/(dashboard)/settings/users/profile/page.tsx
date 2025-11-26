"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { User, Upload, Save } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { getDocument, updateDocument, setDocument } from "@/lib/firebase/firestore";
import { uploadFileToStorage } from "@/lib/firebase/storage";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { UserAvatar } from "@/components/collaboration/UserAvatar";

export default function UserProfilePage() {
  const { user } = useAuth();
  const companyId = useCompanyId();
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    avatarUrl: "",
    phone: "",
    title: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!user || !companyId) return;

    const loadProfile = async () => {
      try {
        // Try to load from members collection
        const memberPath = `companies/${companyId}/members/${user.uid}`;
        const memberDoc = await getDocument(memberPath);

        if (memberDoc) {
          setProfile({
            name: memberDoc.name || user.displayName || "",
            email: memberDoc.email || user.email || "",
            avatarUrl: memberDoc.avatarUrl || user.photoURL || "",
            phone: memberDoc.phone || "",
            title: memberDoc.title || "",
          });
        } else {
          // Fallback to user data
          setProfile({
            name: user.displayName || "",
            email: user.email || "",
            avatarUrl: user.photoURL || "",
            phone: "",
            title: "",
          });
        }
      } catch (error) {
        console.error("Failed to load profile:", error);
      }
    };

    loadProfile();
  }, [user, companyId]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !companyId) return;

    setIsUploading(true);
    try {
      // Upload to Firebase Storage
      const timestamp = Date.now();
      const storagePath = `avatars/${companyId}/${user.uid}/${timestamp}_${file.name}`;
      const downloadURL = await uploadFileToStorage(file, storagePath);

      // Update profile
      setProfile({ ...profile, avatarUrl: downloadURL });

      // Save to Firestore
      const memberPath = `companies/${companyId}/members/${user.uid}`;
      await setDocument(
        memberPath,
        { avatarUrl: downloadURL },
        true
      );
    } catch (error: any) {
      console.error("Failed to upload avatar:", error);
      alert(`Failed to upload avatar: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !companyId) return;

    setIsSaving(true);
    try {
      const memberPath = `companies/${companyId}/members/${user.uid}`;
      await setDocument(
        memberPath,
        {
          userId: user.uid,
          email: user.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          phone: profile.phone || undefined,
          title: profile.title || undefined,
          updatedAt: new Date(),
        },
        true
      );

      alert("Profile updated successfully!");
    } catch (error: any) {
      console.error("Failed to save profile:", error);
      alert(`Failed to save profile: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-600 mt-1">
          Manage your profile information and avatar
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-6">
            <div className="flex-shrink-0">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.name}
                  className="w-24 h-24 rounded-full object-cover border-4 border-gray-200"
                />
              ) : (
                <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center border-4 border-gray-200">
                  <User className="w-12 h-12 text-blue-600" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Profile Picture
              </label>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={isUploading}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    disabled={isUploading}
                    as="span"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {isUploading ? "Uploading..." : "Upload Avatar"}
                  </Button>
                </label>
                <p className="text-xs text-gray-500">
                  JPG, PNG or GIF. Max size 2MB.
                </p>
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <Input
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              placeholder="Your full name"
            />
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <Input
              value={profile.email}
              disabled
              className="bg-gray-50"
            />
            <p className="text-xs text-gray-500 mt-1">
              Email cannot be changed. Contact an administrator if you need to update it.
            </p>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Job Title
            </label>
            <Input
              value={profile.title}
              onChange={(e) => setProfile({ ...profile, title: e.target.value })}
              placeholder="e.g., Senior Estimator, Project Manager"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <Input
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              placeholder="(555) 123-4567"
            />
          </div>

          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

