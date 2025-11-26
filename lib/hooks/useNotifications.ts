import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { useCompanyId } from "./useCompanyId";
import { subscribeToCollection, createDocument, updateDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { serverTimestamp } from "firebase/firestore";

export interface Notification {
  id: string;
  userId: string;
  type: "lock" | "unlock" | "comment" | "mention" | "activity";
  title: string;
  message: string;
  projectId?: string;
  section?: string;
  read: boolean;
  createdAt: any;
  link?: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const companyId = useCompanyId();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!isFirebaseConfigured() || !user || !companyId) {
      return;
    }

    const notificationsPath = `companies/${companyId}/notifications/${user.uid}/items`;
    const unsubscribe = subscribeToCollection<Notification>(
      notificationsPath,
      (data) => {
        const sorted = data.sort((a, b) => {
          const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return bTime - aTime;
        });
        setNotifications(sorted);
        setUnreadCount(sorted.filter((n) => !n.read).length);
      }
    );

    return () => unsubscribe();
  }, [user, companyId]);

  const markAsRead = async (notificationId: string) => {
    if (!isFirebaseConfigured() || !user || !companyId) return;

    try {
      await updateDocument(
        `companies/${companyId}/notifications/${user.uid}/items`,
        notificationId,
        { read: true }
      );
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!isFirebaseConfigured() || !user || !companyId) return;

    try {
      const unreadNotifications = notifications.filter((n) => !n.read);
      await Promise.all(
        unreadNotifications.map((n) =>
          updateDocument(
            `companies/${companyId}/notifications/${user.uid}/items`,
            n.id,
            { read: true }
          )
        )
      );
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
}

export async function createNotification(
  companyId: string,
  userId: string,
  notification: Omit<Notification, "id" | "read" | "createdAt">
) {
  if (!isFirebaseConfigured()) return;

  try {
    const notificationsPath = `companies/${companyId}/notifications/${userId}/items`;
    await createDocument(notificationsPath, {
      ...notification,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}

