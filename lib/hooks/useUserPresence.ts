import { useState, useEffect, useRef } from "react";
import { useAuth } from "./useAuth";
import { useCompanyId } from "./useCompanyId";
import { getDocRef, setDocument, deleteDocument, subscribeToCollection } from "@/lib/firebase/firestore";
import { onSnapshot, Timestamp, serverTimestamp } from "firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";

export interface ActiveUser {
  id: string;
  name: string;
  viewing: string;
  lastSeen: any;
}

export function useUserPresence(projectId: string | null, currentPage: string = "details") {
  const { user } = useAuth();
  const companyId = useCompanyId();
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Set user as active and update heartbeat
  useEffect(() => {
    if (!isFirebaseConfigured() || !user || !projectId || !companyId) {
      return;
    }

    const presencePath = `companies/${companyId}/projects/${projectId}/activeUsers/${user.uid}`;
    const presenceRef = getDocRef(presencePath);

    // Set initial presence
    const setPresence = async () => {
      try {
        await setDocument(
          presencePath,
          {
            name: user.displayName || user.email || "Unknown User",
            viewing: currentPage,
            lastSeen: serverTimestamp(),
          },
          true // merge
        );
      } catch (error) {
        console.error("Failed to set presence:", error);
      }
    };

    setPresence();

    // Update heartbeat every 30 seconds
    heartbeatIntervalRef.current = setInterval(() => {
      setPresence();
    }, 30000);

    // Update viewing page when it changes
    const updateViewing = async () => {
      try {
        await setDocument(
          presencePath,
          {
            viewing: currentPage,
            lastSeen: serverTimestamp(),
          },
          true
        );
      } catch (error) {
        console.error("Failed to update viewing:", error);
      }
    };

    updateViewing();

    // Cleanup on unmount
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      // Remove presence
      deleteDocument(
        `companies/${companyId}/projects/${projectId}/activeUsers`,
        user.uid
      ).catch((error) => {
        console.error("Failed to remove presence:", error);
      });
    };
  }, [user, projectId, companyId, currentPage]);

  // Subscribe to other users' presence
  useEffect(() => {
    if (!isFirebaseConfigured() || !projectId || !companyId || !user) {
      return;
    }

    const activeUsersPath = `companies/${companyId}/projects/${projectId}/activeUsers`;
    const unsubscribe = subscribeToCollection<ActiveUser>(
      activeUsersPath,
      (users) => {
        // Filter out current user and filter by recent activity (last 2 minutes)
        const now = Date.now();
        const filtered = users
          .filter((u) => u.id !== user.uid)
          .filter((u) => {
            if (!u.lastSeen) return false;
            const lastSeenTime = u.lastSeen.toMillis ? u.lastSeen.toMillis() : u.lastSeen;
            return now - lastSeenTime < 120000; // 2 minutes
          });
        setActiveUsers(filtered);
      }
    );

    return () => unsubscribe();
  }, [projectId, companyId, user]);

  return { activeUsers };
}

