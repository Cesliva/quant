/**
 * Firestore service for Proposal Seeds CRUD operations
 */

import { 
  subscribeToCollection, 
  createDocument, 
  updateDocument, 
  deleteDocument,
  getProjectPath 
} from "@/lib/firebase/firestore";
import { Timestamp } from "firebase/firestore";
import { ProposalSeed, ProposalSeedStatus } from "@/lib/types/proposalSeeds";
import { isFirebaseConfigured } from "@/lib/firebase/config";

/**
 * Get the Firestore path for proposal seeds collection
 */
export function getProposalSeedsPath(companyId: string, projectId: string): string {
  return getProjectPath(companyId, projectId, "proposalSeeds");
}

/**
 * Create a new proposal seed
 */
export async function createProposalSeed(
  companyId: string,
  projectId: string,
  seed: Omit<ProposalSeed, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured");
  }

  const seedsPath = getProposalSeedsPath(companyId, projectId);
  const seedData = {
    ...seed,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  return await createDocument(seedsPath, seedData);
}

/**
 * Update an existing proposal seed
 */
export async function updateProposalSeed(
  companyId: string,
  projectId: string,
  seedId: string,
  updates: Partial<Omit<ProposalSeed, "id" | "createdAt" | "createdBy">>
): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured");
  }

  const seedPath = `${getProposalSeedsPath(companyId, projectId)}/${seedId}`;
  await updateDocument(seedPath, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Archive a proposal seed (soft delete)
 */
export async function archiveProposalSeed(
  companyId: string,
  projectId: string,
  seedId: string
): Promise<void> {
  await updateProposalSeed(companyId, projectId, seedId, { status: "archived" });
}

/**
 * Delete a proposal seed permanently
 */
export async function deleteProposalSeed(
  companyId: string,
  projectId: string,
  seedId: string
): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured");
  }

  const seedsPath = getProposalSeedsPath(companyId, projectId);
  await deleteDocument(seedsPath, seedId);
}

/**
 * Subscribe to proposal seeds for a project
 */
export function subscribeToProposalSeeds(
  companyId: string,
  projectId: string,
  callback: (seeds: ProposalSeed[]) => void,
  includeArchived: boolean = false
): () => void {
  if (!isFirebaseConfigured()) {
    callback([]);
    return () => {};
  }

  const seedsPath = getProposalSeedsPath(companyId, projectId);
  return subscribeToCollection<ProposalSeed>(
    seedsPath,
    (seeds) => {
      // Filter by status and sort by createdAt desc
      const filtered = includeArchived 
        ? seeds 
        : seeds.filter(s => s.status === "active");
      
      const sorted = filtered.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime; // Newest first
      });

      callback(sorted);
    }
  );
}

