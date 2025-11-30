/**
 * Syncs project status changes to win/loss records
 * When a project status changes to "won" or "lost", automatically
 * create or update a corresponding win/loss record
 */

import { 
  getDocument, 
  createDocument, 
  updateDocument
} from "@/lib/firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase/config";
import { Timestamp, query, where, getDocs, collection } from "firebase/firestore";

interface Project {
  id: string;
  projectName?: string;
  projectNumber?: string;
  bidDueDate?: string;
  status?: string;
  estimatedValue?: string | number;
  awardValue?: number;
  generalContractor?: string;
  gcId?: string;
  projectType?: string;
}

interface WinLossRecord {
  id?: string;
  projectId?: string;
  projectName: string;
  bidDate: string;
  decisionDate: string;
  bidAmount: number;
  projectValue?: number;
  status: "won" | "lost";
  createdAt?: any;
  updatedAt?: any;
}

/**
 * Syncs a project's status change to the win/loss records collection
 */
export async function syncProjectToWinLoss(
  companyId: string,
  project: Project,
  oldStatus?: string
): Promise<void> {
  if (!isFirebaseConfigured() || !db) {
    console.warn("Firebase not configured, skipping win/loss sync");
    return;
  }

  const newStatus = project.status?.toLowerCase();
  
  // Only sync if status is "won" or "lost"
  if (newStatus !== "won" && newStatus !== "lost") {
    // If status changed from won/lost to something else, we could delete the record
    // For now, we'll leave existing records intact
    return;
  }

  try {
    const recordsPath = `companies/${companyId}/winLossRecords`;
    
    // Check if a record already exists for this project
    const recordsRef = collection(db, recordsPath);
    const q = query(recordsRef, where("projectId", "==", project.id));
    const existingRecords = await getDocs(q);
    
    const today = new Date().toISOString().split("T")[0];
    const bidDate = project.bidDueDate 
      ? new Date(project.bidDueDate).toISOString().split("T")[0]
      : today;
    
    const estimatedValue = typeof project.estimatedValue === "string"
      ? parseFloat(project.estimatedValue) || 0
      : project.estimatedValue || 0;
    
    const recordData: Omit<WinLossRecord, "id"> = {
      projectId: project.id,
      projectName: project.projectName || project.projectNumber || "Untitled Project",
      bidDate: bidDate,
      decisionDate: today, // Use today as decision date when status changes
      bidAmount: estimatedValue || 0,
      projectValue: project.awardValue || estimatedValue || undefined,
      status: newStatus as "won" | "lost",
      updatedAt: Timestamp.now(),
    };

    if (!existingRecords.empty) {
      // Update existing record
      const existingRecord = existingRecords.docs[0];
      await updateDocument(recordsPath, existingRecord.id, recordData);
      console.log(`Updated win/loss record for project ${project.id}`);
    } else {
      // Create new record
      recordData.createdAt = Timestamp.now();
      await createDocument(recordsPath, recordData);
      console.log(`Created win/loss record for project ${project.id}`);
    }
  } catch (error) {
    console.error("Failed to sync project to win/loss records:", error);
    // Don't throw - we don't want to block the project status update
  }
}

