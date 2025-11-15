/**
 * Utility to completely clear all projects and sample data from Firestore
 * WARNING: This is a destructive operation that cannot be undone
 */

import { queryDocuments, getDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured, db } from "@/lib/firebase/config";
import {
  collection,
  doc,
  getDocs,
  writeBatch,
  deleteDoc,
} from "firebase/firestore";

export interface Project {
  id: string;
  projectName?: string;
  projectNumber?: string;
  archived?: boolean;
  isSampleData?: boolean;
}

const SUBCOLLECTIONS_TO_DELETE = [
  { name: "lines", countAs: "lines" },
  { name: "aiLogs", countAs: "logs" },
  { name: "aiUsageLogs", countAs: "logs" },
  { name: "aiUsage", countAs: "logs" },
  { name: "proposalLogs", countAs: "logs" },
];

export async function deleteProjectFromFirestore(
  companyId: string,
  projectId: string
): Promise<{ deletedLines: number; deletedLogs: number }> {
  if (!db) {
    throw new Error("Firestore database not initialized");
  }

  let lineCount = 0;
  let logCount = 0;

  for (const sub of SUBCOLLECTIONS_TO_DELETE) {
    const subRef = collection(
      db,
      "companies",
      companyId,
      "projects",
      projectId,
      sub.name
    );
    const snapshot = await getDocs(subRef);
    if (snapshot.empty) continue;

    const batch = writeBatch(db);
    snapshot.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();

    if (sub.countAs === "lines") {
      lineCount += snapshot.size;
    } else if (sub.countAs === "logs") {
      logCount += snapshot.size;
    }
  }

  const projectRef = doc(db, "companies", companyId, "projects", projectId);
  await deleteDoc(projectRef);

  return { deletedLines: lineCount, deletedLogs: logCount };
}

export async function clearAllFirestoreData(
  companyId: string = "default"
): Promise<{
  deletedProjects: number;
  deletedLines: number;
  deletedLogs: number;
  deletedRecords: number;
  errors: string[];
}> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured");
  }

  if (!db) {
    throw new Error("Firestore database not initialized");
  }

  const projectsPath = `companies/${companyId}/projects`;
  const errors: string[] = [];
  let deletedProjects = 0;
  let deletedLines = 0;
  let deletedLogs = 0;
  let deletedRecords = 0;

  try {
    // Get all projects
    const allProjects = await queryDocuments<Project>(projectsPath);
    console.log(`Found ${allProjects.length} project(s) to delete`);

    // Delete each project and all its subcollections
    for (const project of allProjects) {
      try {
        console.log(
          `Deleting project: ${project.id} (${project.projectName || "Untitled"})`
        );

        const { deletedLines: linesDeleted, deletedLogs: logsDeleted } =
          await deleteProjectFromFirestore(companyId, project.id);
        deletedLines += linesDeleted;
        deletedLogs += logsDeleted;

        // Verify the document was actually removed
        const verifyPath = `${projectsPath}/${project.id}`;
        const stillExists = await getDocument<Project>(verifyPath);
        if (stillExists) {
          const errorMsg = `Project ${project.id} still exists after delete attempt.`;
          errors.push(errorMsg);
          console.error(errorMsg, stillExists);
        } else {
          deletedProjects++;
          console.log(`Successfully deleted project: ${project.id}`);
        }
      } catch (error: any) {
        const errorMsg = `Failed to delete project ${project.id}: ${
          error?.message || "Unknown error"
        }`;
        errors.push(errorMsg);
        console.error(errorMsg, error);
      }
    }

    // Delete all win/loss records at company level (if they exist)
    const winLossPath = `companies/${companyId}/winLossRecords`;
    try {
      const winLossRef = collection(
        db,
        "companies",
        companyId,
        "winLossRecords"
      );
      const recordsSnapshot = await getDocs(winLossRef);
      if (!recordsSnapshot.empty) {
        const batch = writeBatch(db);
        recordsSnapshot.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
        deletedRecords += recordsSnapshot.size;
      }
    } catch (error: any) {
      console.warn(`Failed to query win/loss records:`, error);
    }

    // Wait a moment for Firestore to propagate deletions
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log(
      `Cleanup complete: ${deletedProjects} project(s), ${deletedLines} line(s), ${deletedLogs} log(s), ${deletedRecords} win/loss record(s) deleted`
    );

    return {
      deletedProjects,
      deletedLines,
      deletedLogs,
      deletedRecords,
      errors,
    };
  } catch (error: any) {
    console.error("Failed to clear Firestore data:", error);
    throw error;
  }
}

