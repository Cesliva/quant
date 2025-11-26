/**
 * Utility to fix projects with undefined archived status
 * This ensures all projects have an explicit archived: true or false field
 */

import { queryDocuments } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";

interface Project {
  id: string;
  projectName?: string;
  archived?: boolean;
}

/**
 * Fix projects with undefined archived status
 * @param companyId - Company ID (should be obtained from useCompanyId() hook in components)
 *                    Default "default" is for backward compatibility and script usage only
 */
export async function fixArchivedStatus(companyId: string = "default"): Promise<{
  fixed: number;
  errors: string[];
}> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured");
  }

  const projectsPath = `companies/${companyId}/projects`;
  const allProjects = await queryDocuments<Project>(projectsPath);
  
  let fixed = 0;
  const errors: string[] = [];

  for (const project of allProjects) {
    // Only fix projects where archived is undefined
    if (project.archived === undefined) {
      try {
        // First, verify the document exists in Firestore
        const { getDocument, setDocument } = await import("@/lib/firebase/firestore");
        const fullProjectPath = `${projectsPath}/${project.id}`;
        
        // Check if document exists before trying to update
        const existingDoc = await getDocument(fullProjectPath);
        if (!existingDoc) {
          // Document doesn't exist - skip it (it may have been deleted)
          console.warn(`Skipping project ${project.id} (${project.projectName || "Untitled"}): document does not exist in Firestore`);
          continue;
        }
        
        // Use setDocument with merge to update the document
        await setDocument(fullProjectPath, {
          archived: false,
        }, true); // merge: true to preserve other fields
        fixed++;
        console.log(`Fixed project ${project.id} (${project.projectName || "Untitled"}): set archived=false`);
      } catch (error: any) {
        // Only log errors that aren't "document doesn't exist" errors
        if (!error?.message?.includes("No document") && !error?.message?.includes("not found")) {
          const errorMsg = `Failed to fix project ${project.id}: ${error?.message || "Unknown error"}`;
          errors.push(errorMsg);
          console.error(errorMsg, error);
        } else {
          // Document doesn't exist - this is expected for deleted projects
          console.warn(`Skipping project ${project.id} (${project.projectName || "Untitled"}): document does not exist in Firestore`);
        }
      }
    }
  }

  return { fixed, errors };
}

