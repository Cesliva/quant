import { createDocument } from "@/lib/firebase/firestore";
import { serverTimestamp } from "firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { auth } from "@/lib/firebase/config";

export interface ActivityLog {
  userId: string;
  userName: string;
  action: string;
  details?: any;
  timestamp: any;
}

export async function logActivity(
  companyId: string,
  projectId: string,
  action: string,
  details?: any
): Promise<void> {
  if (!isFirebaseConfigured() || !auth) {
    return;
  }

  // Get current user from auth directly (not using hooks)
  const currentUser = auth.currentUser;

  if (!currentUser) {
    console.warn("Cannot log activity: user not authenticated");
    return;
  }

  try {
    const activitiesPath = `companies/${companyId}/projects/${projectId}/activities`;
    await createDocument(activitiesPath, {
      userId: currentUser.uid,
      userName: currentUser.displayName || currentUser.email || "Unknown User",
      action,
      details: details || {},
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
    // Don't throw - activity logging shouldn't break the app
  }
}

// Helper function to format activity messages
export function formatActivity(action: string): string {
  const actionMap: Record<string, string> = {
    viewed_details: "viewed project details",
    viewed_estimating: "viewed estimating page",
    viewed_reports: "viewed reports",
    created_line: "created a line item",
    updated_line: "updated a line item",
    deleted_line: "deleted a line item",
    updated_project: "updated project information",
    uploaded_file: "uploaded a file",
    deleted_file: "deleted a file",
    generated_proposal: "generated a proposal",
    exported_report: "exported a report",
    locked_section: "locked a section",
    unlocked_section: "unlocked a section",
    added_comment: "added a comment",
    deleted_comment: "deleted a comment",
  };

  return actionMap[action] || action;
}

