"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import { useState, useEffect } from "react";
import { subscribeToCollection, getDocument } from "@/lib/firebase/firestore";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { isFirebaseConfigured } from "@/lib/firebase/config";

interface UserProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  initials?: string;
  role?: string;
}

interface UserAvatarProps {
  userId: string;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

export function UserAvatar({ userId, size = "md", showName = false, className = "" }: UserAvatarProps) {
  const { user: currentUser } = useAuth();
  const companyId = useCompanyId();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured() || !userId || !companyId) {
      return;
    }

    const loadProfile = async () => {
      try {
        // Try to get from members collection first
        const memberPath = `companies/${companyId}/members/${userId}`;
        const memberDoc = await getDocument(memberPath);
        
        if (memberDoc) {
          setProfile({
            id: userId,
            userId: memberDoc.userId || userId,
            name: memberDoc.name || memberDoc.email || "Unknown User",
            email: memberDoc.email || "",
            avatarUrl: memberDoc.avatarUrl,
            role: memberDoc.role,
          });
        } else {
          // Fallback: try to get from users collection
          const userDoc = await getDocument(`users/${userId}`);
          if (userDoc) {
            setProfile({
              id: userId,
              userId,
              name: userDoc.displayName || userDoc.email || "Unknown User",
              email: userDoc.email || "",
              avatarUrl: userDoc.photoURL,
            });
          }
        }
      } catch (error) {
        console.error("Failed to load user profile:", error);
      }
    };

    loadProfile();
  }, [userId, companyId]);

  const sizeClasses = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-12 h-12 text-base",
  };

  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const displayName = profile?.name || "Unknown";
  const avatarUrl = profile?.avatarUrl;
  const initials = profile?.initials || getInitials(displayName);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className={`${sizeClasses[size]} bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden`}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="font-medium text-blue-600">{initials}</span>
        )}
      </div>
      {showName && (
        <span className="text-sm text-gray-700">{displayName}</span>
      )}
    </div>
  );
}

