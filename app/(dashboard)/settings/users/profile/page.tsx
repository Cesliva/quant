"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { User, Upload, Save } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { getDocument, updateDocument, setDocument } from "@/lib/firebase/firestore";
import { uploadFileToStorage, isStorageConfigured } from "@/lib/firebase/storage";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { UserAvatar } from "@/components/collaboration/UserAvatar";

export default function UserProfilePage() {
  const { user } = useAuth();
  const companyId = useCompanyId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    avatarUrl: "",
    phone: "",
    title: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleUploadClick = () => {
    if (fileInputRef.current && !isUploading) {
      fileInputRef.current.click();
    }
  };

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
    if (!file || !user) {
      console.log("[Avatar] No file or user");
      return;
    }
    
    console.log("[Avatar] Starting upload for file:", file.name, "size:", file.size);
    
    // Check if Firebase Storage is configured
    if (!isStorageConfigured()) {
      alert("Firebase Storage is not configured. Please check NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in your environment.");
      e.target.value = "";
      return;
    }
    
    // Ensure we have a valid companyId before uploading
    if (!companyId || companyId === "default") {
      alert("Unable to upload avatar. Please wait for your profile to fully load and try again.");
      e.target.value = "";
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      alert("File is too large. Maximum size is 2MB.");
      e.target.value = "";
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file (JPG, PNG, or GIF).");
      e.target.value = "";
      return;
    }

    setIsUploading(true);
    
    // Create a timeout promise to prevent infinite hanging
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        console.error("[Avatar] Upload timed out after 30 seconds");
        reject(new Error("Upload timed out after 30 seconds. Please check your internet connection and Firebase Storage configuration."));
      }, 30000);
    });
    
    try {
      // Upload to Firebase Storage with timeout
      const timestamp = Date.now();
      const storagePath = `avatars/${companyId}/${user.uid}/${timestamp}_${file.name}`;
      console.log("[Avatar] Uploading to path:", storagePath);
      
      const uploadPromise = uploadFileToStorage(file, storagePath);
      const downloadURL = await Promise.race([uploadPromise, timeoutPromise]);

      console.log("[Avatar] Upload successful, URL:", downloadURL);

      // Update profile
      setProfile((prev) => ({ ...prev, avatarUrl: downloadURL }));

      // Save to Firestore
      const memberPath = `companies/${companyId}/members/${user.uid}`;
      await setDocument(
        memberPath,
        { avatarUrl: downloadURL },
        true
      );
      
      console.log("[Avatar] Saved to Firestore");
      alert("Avatar uploaded successfully!");
    } catch (error: any) {
      console.error("[Avatar] Failed to upload:", error);
      alert(`Failed to upload avatar: ${error.message || "Unknown error occurred"}`);
    } finally {
      setIsUploading(false);
      // Reset the input so the same file can be selected again if needed
      e.target.value = "";
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
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif"
                  onChange={handleAvatarUpload}
                  disabled={isUploading}
                  style={{ display: "none" }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUploadClick}
                  disabled={isUploading}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isUploading ? "Uploading..." : "Upload Avatar"}
                </Button>
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

