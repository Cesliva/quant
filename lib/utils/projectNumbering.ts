/**
 * Project Numbering Utility
 * 
 * Generates project numbers based on company settings and handles
 * atomic sequence increments in Firestore.
 */

import { loadCompanySettings } from "./settingsLoader";
import { getDocument, updateDocument } from "@/lib/firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase/config";

export interface ProjectNumberingSettings {
  prefix: string;
  yearFormat: "YY" | "YYYY";
  sequencePadding: number;
  resetEachYear: boolean;
  nextSequence: number;
}

const DEFAULT_NUMBERING: ProjectNumberingSettings = {
  prefix: "Q",
  yearFormat: "YYYY",
  sequencePadding: 3,
  resetEachYear: true,
  nextSequence: 1,
};

/**
 * Get project numbering settings from company settings
 */
export async function getProjectNumberingSettings(
  companyId: string
): Promise<ProjectNumberingSettings> {
  const companySettings = await loadCompanySettings(companyId);
  const numbering = companySettings.projectNumbering || {};

  const currentYear = new Date().getFullYear();
  const lastYear = numbering.nextSequence ? 
    (await getLastProjectYear(companyId)) : currentYear;

  // If resetEachYear is true and we're in a new year, reset sequence
  if (numbering.resetEachYear && lastYear !== currentYear) {
    return {
      ...DEFAULT_NUMBERING,
      ...numbering,
      nextSequence: 1,
    };
  }

  return {
    ...DEFAULT_NUMBERING,
    ...numbering,
    nextSequence: numbering.nextSequence || 1,
  };
}

/**
 * Get the year of the last created project (for reset detection)
 */
async function getLastProjectYear(companyId: string): Promise<number> {
  if (!isFirebaseConfigured() || !db) {
    return new Date().getFullYear();
  }

  try {
    const { query, collection, orderBy, limit, getDocs } = await import("firebase/firestore");
    const projectsPath = `companies/${companyId}/projects`;
    const q = query(
      collection(db, projectsPath),
      orderBy("createdAt", "desc"),
      limit(1)
    );
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const project = snapshot.docs[0].data();
      if (project.createdAt) {
        const createdAt = project.createdAt.toDate ? project.createdAt.toDate() : new Date(project.createdAt);
        return createdAt.getFullYear();
      }
    }
  } catch (error) {
    console.warn("Could not determine last project year:", error);
  }

  return new Date().getFullYear();
}

/**
 * Generate a project number based on settings
 */
export function generateProjectNumber(settings: ProjectNumberingSettings): string {
  const now = new Date();
  const year = now.getFullYear();
  const yearStr = settings.yearFormat === "YY" 
    ? String(year).slice(-2)
    : String(year);
  
  const sequenceStr = String(settings.nextSequence).padStart(
    settings.sequencePadding,
    "0"
  );

  return `${settings.prefix}-${yearStr}-${sequenceStr}`;
}

/**
 * Atomically increment the project sequence number in company settings
 */
export async function incrementProjectSequence(
  companyId: string
): Promise<number> {
  if (!isFirebaseConfigured() || !db) {
    throw new Error("Firebase not configured");
  }

  try {
    const { doc, runTransaction } = await import("firebase/firestore");
    const companyRef = doc(db!, `companies/${companyId}`);

    // Get last project year before transaction
    const currentYear = new Date().getFullYear();
    const lastYear = await getLastProjectYear(companyId);

    const newSequence = await runTransaction(db!, async (transaction) => {
      const companyDoc = await transaction.get(companyRef);
      const currentData = companyDoc.data() || {};
      const settings = currentData.settings || {};
      const numbering = settings.projectNumbering || {};

      // Reset sequence if new year and resetEachYear is true
      let nextSeq = numbering.nextSequence || 1;
      if (numbering.resetEachYear && lastYear !== currentYear) {
        nextSeq = 1;
      } else {
        nextSeq = (numbering.nextSequence || 0) + 1;
      }

      // Update the settings
      transaction.update(companyRef, {
        "settings.projectNumbering": {
          prefix: numbering.prefix || DEFAULT_NUMBERING.prefix,
          yearFormat: numbering.yearFormat || DEFAULT_NUMBERING.yearFormat,
          sequencePadding: numbering.sequencePadding || DEFAULT_NUMBERING.sequencePadding,
          resetEachYear: numbering.resetEachYear !== false,
          nextSequence: nextSeq,
        },
      });

      return nextSeq;
    });

    return newSequence;
  } catch (error) {
    console.error("Error incrementing project sequence:", error);
    // Fallback: try non-transactional update
    try {
      const companyPath = `companies/${companyId}`;
      const company = await getDocument<{ settings?: any }>(companyPath);
      const settings = company?.settings || {};
      const numbering = settings.projectNumbering || {};
      const nextSeq = (numbering.nextSequence || 0) + 1;

      await updateDocument("companies", companyId, {
        "settings.projectNumbering": {
          ...DEFAULT_NUMBERING,
          ...numbering,
          nextSequence: nextSeq,
        },
      });

      return nextSeq;
    } catch (fallbackError) {
      console.error("Fallback increment also failed:", fallbackError);
      throw new Error("Failed to increment project sequence");
    }
  }
}

