import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { useCompanyId } from "./useCompanyId";
import { getDocRef, setDocument, deleteDocument, subscribeToCollection } from "@/lib/firebase/firestore";
import { onSnapshot, Timestamp, serverTimestamp } from "firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { createNotification } from "./useNotifications";

export interface LockInfo {
  userId: string;
  userName: string;
  lockedAt: any;
}

export function useEditLock(projectId: string | null, section: string) {
  const { user } = useAuth();
  const companyId = useCompanyId();
  const [lock, setLock] = useState<LockInfo | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  // Subscribe to lock changes
  useEffect(() => {
    if (!isFirebaseConfigured() || !projectId || !companyId || !section) {
      return;
    }

    const lockPath = `companies/${companyId}/projects/${projectId}/locks/${section}`;
    const lockRef = getDocRef(lockPath);

    const unsubscribe = onSnapshot(
      lockRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const lockData = snapshot.data() as LockInfo;
          setLock(lockData);
          setIsLocked(lockData.userId !== user?.uid);
        } else {
          setLock(null);
          setIsLocked(false);
        }
      },
      (error) => {
        console.error("Error subscribing to lock:", error);
      }
    );

    return () => unsubscribe();
  }, [projectId, section, companyId, user]);

  const acquireLock = async (): Promise<boolean> => {
    if (!isFirebaseConfigured() || !projectId || !companyId || !user || !section) {
      return false;
    }

    try {
      const lockPath = `companies/${companyId}/projects/${projectId}/locks/${section}`;
      
      // Check if already locked by someone else
      if (lock && lock.userId !== user.uid) {
        return false;
      }

      await setDocument(
        lockPath,
        {
          userId: user.uid,
          userName: user.displayName || user.email || "Unknown User",
          lockedAt: serverTimestamp(),
        },
        false // Don't merge - overwrite
      );

      // Notify other users who were viewing this section (async, don't block)
      if (projectId) {
        // Get active users and send notifications (non-blocking)
        setTimeout(async () => {
          try {
            const activeUsersPath = `companies/${companyId}/projects/${projectId}/activeUsers`;
            let activeUsers: any[] = [];
            
            // Use a one-time snapshot instead of subscription
            const { getDocs, collection } = await import("firebase/firestore");
            const { db } = await import("@/lib/firebase/config");
            if (db) {
              const snapshot = await getDocs(collection(db, activeUsersPath));
              activeUsers = snapshot.docs
                .map((doc) => ({ id: doc.id, ...doc.data() }))
                .filter((u) => u.id !== user.uid);
            }

            // Send notifications to active users
            for (const activeUser of activeUsers) {
              await createNotification(companyId, activeUser.id, {
                userId: user.uid,
                type: "lock",
                title: "Section Locked",
                message: `${user.displayName || user.email} locked the ${section} section`,
                projectId,
                section,
                link: `/projects/${projectId}`,
              });
            }
          } catch (error) {
            console.error("Failed to send lock notifications:", error);
          }
        }, 100);
      }

      return true;
    } catch (error) {
      console.error("Failed to acquire lock:", error);
      return false;
    }
  };

  const releaseLock = async (): Promise<void> => {
    if (!isFirebaseConfigured() || !projectId || !companyId || !section) {
      return;
    }

    try {
      const lockPath = `companies/${companyId}/projects/${projectId}/locks/${section}`;
      await deleteDocument(`companies/${companyId}/projects/${projectId}/locks`, section);

      // Notify active users that section is now available (async, don't block)
      if (projectId && user) {
        setTimeout(async () => {
          try {
            const activeUsersPath = `companies/${companyId}/projects/${projectId}/activeUsers`;
            let activeUsers: any[] = [];
            
            const { getDocs, collection } = await import("firebase/firestore");
            const { db } = await import("@/lib/firebase/config");
            if (db) {
              const snapshot = await getDocs(collection(db, activeUsersPath));
              activeUsers = snapshot.docs
                .map((doc) => ({ id: doc.id, ...doc.data() }))
                .filter((u) => u.id !== user.uid);
            }

            for (const activeUser of activeUsers) {
              await createNotification(companyId, activeUser.id, {
                userId: user.uid,
                type: "unlock",
                title: "Section Unlocked",
                message: `${user.displayName || user.email} unlocked the ${section} section`,
                projectId,
                section,
                link: `/projects/${projectId}`,
              });
            }
          } catch (error) {
            console.error("Failed to send unlock notifications:", error);
          }
        }, 100);
      }
    } catch (error) {
      console.error("Failed to release lock:", error);
    }
  };

  const canEdit = !isLocked || (lock?.userId === user?.uid);

  return {
    lock,
    isLocked,
    canEdit,
    acquireLock,
    releaseLock,
  };
}

