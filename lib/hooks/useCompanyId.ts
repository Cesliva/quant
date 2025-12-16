/**
 * Hook to get company ID from auth context
 * Fetches companyId from user document in Firestore
 */

import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { getDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";

interface UserDocument {
  companyId?: string;
  company?: string;
}

export function useCompanyId(): string {
  const { user, loading: authLoading } = useAuth();
  const [companyId, setCompanyId] = useState<string>("default");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompanyId = async () => {
      // If auth is still loading, wait
      if (authLoading) {
        return;
      }

      // If Firebase is not configured, use default
      if (!isFirebaseConfigured()) {
        setCompanyId("default");
        setLoading(false);
        return;
      }

      // If user is not authenticated, use default
      if (!user?.uid) {
        setCompanyId("default");
        setLoading(false);
        return;
      }

      try {
        // Try to get companyId from user document
        // Check both possible paths: users/{uid} or companies/{companyId}/members/{uid}
        const userDoc = await getDocument<UserDocument>(`users/${user.uid}`);
        
        if (userDoc?.companyId) {
          setCompanyId(userDoc.companyId);
        } else if (userDoc?.company) {
          setCompanyId(userDoc.company);
        } else {
          // Fallback: try to find company from members collection
          // This would require querying, so for now we'll use default
          // In production, you should ensure user documents have companyId
          console.warn(`User ${user.uid} does not have companyId in user document. Using default.`);
          setCompanyId("default");
        }
      } catch (error) {
        console.warn("Failed to fetch user companyId, using default:", error);
        setCompanyId("default");
      } finally {
        setLoading(false);
      }
    };

    fetchCompanyId();
  }, [user, authLoading]);

  return companyId;
}

