import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { getDocument, updateDocument } from "@/lib/firebase/firestore";
import { getProjectPath } from "@/lib/firebase/firestore";

export interface ConflictResolution {
  strategy: "last-write-wins" | "merge" | "manual";
  conflicts: Array<{
    field: string;
    localValue: any;
    remoteValue: any;
  }>;
}

/**
 * Detects conflicts between local and remote versions of a line
 */
export async function detectConflicts(
  companyId: string,
  projectId: string,
  lineId: string,
  localVersion: Partial<EstimatingLine>,
  currentLines?: EstimatingLine[] // Pass current lines to avoid extra fetch
): Promise<ConflictResolution | null> {
  try {
    let remoteLine: EstimatingLine | null = null;
    
    // If current lines are provided, use them (more efficient)
    if (currentLines) {
      remoteLine = currentLines.find(l => l.lineId === lineId) || null;
    } else {
      // Otherwise, fetch from Firestore
      const linesPath = getProjectPath(companyId, projectId, "lines");
      const { queryDocuments } = await import("@/lib/firebase/firestore");
      const { where } = await import("firebase/firestore");
      const lines = await queryDocuments<EstimatingLine>(
        linesPath,
        [where("lineId", "==", lineId)]
      );
      remoteLine = lines[0] || null;
    }

    if (!remoteLine) {
      return null; // No remote version, no conflict
    }

    const conflicts: ConflictResolution["conflicts"] = [];
    const fieldsToCheck: (keyof EstimatingLine)[] = [
      "itemDescription",
      "quantity",
      "length",
      "width",
      "thickness",
      "materialRate",
      "laborRate",
      "coatingRate",
      "status",
    ];

    for (const field of fieldsToCheck) {
      const localVal = localVersion[field];
      const remoteVal = remoteLine[field];

      // Only consider it a conflict if both values exist and are different
      if (
        localVal !== undefined &&
        remoteVal !== undefined &&
        localVal !== remoteVal
      ) {
        // Check if the remote was updated more recently
        const remoteUpdated = remoteLine.updatedAt?.toMillis
          ? remoteLine.updatedAt.toMillis()
          : 0;
        const localUpdated = Date.now(); // Assume local is current

        if (remoteUpdated > localUpdated - 5000) {
          // Remote was updated within last 5 seconds, potential conflict
          conflicts.push({
            field,
            localValue: localVal,
            remoteValue: remoteVal,
          });
        }
      }
    }

    if (conflicts.length === 0) {
      return null;
    }

    return {
      strategy: "last-write-wins", // Default strategy
      conflicts,
    };
  } catch (error) {
    console.error("Error detecting conflicts:", error);
    return null;
  }
}

/**
 * Resolves conflicts using the specified strategy
 */
export async function resolveConflicts(
  companyId: string,
  projectId: string,
  lineId: string,
  localVersion: Partial<EstimatingLine>,
  resolution: ConflictResolution
): Promise<Partial<EstimatingLine>> {
  const resolved = { ...localVersion };

  switch (resolution.strategy) {
    case "last-write-wins":
      // Use remote values (they're more recent)
      for (const conflict of resolution.conflicts) {
        // We'll fetch the remote version and use those values
        const linesPath = getProjectPath(companyId, projectId, "lines");
        const remoteLine = await getDocument<EstimatingLine>(
          `${linesPath}/${lineId}`
        );
        if (remoteLine) {
          (resolved as any)[conflict.field] = conflict.remoteValue;
        }
      }
      break;

    case "merge":
      // Use local values (user's current edits take precedence)
      // Remote values are already in resolved, so we keep local
      break;

    case "manual":
      // Return conflicts for user to resolve manually
      // This would typically show a UI dialog
      break;
  }

  return resolved;
}

/**
 * Smart merge: combines local and remote changes intelligently
 */
export function smartMerge(
  local: Partial<EstimatingLine>,
  remote: EstimatingLine
): Partial<EstimatingLine> {
  const merged = { ...remote, ...local };

  // For numeric fields, if both changed, prefer the larger value (more conservative)
  const numericFields: (keyof EstimatingLine)[] = [
    "quantity",
    "length",
    "width",
    "thickness",
  ];

  for (const field of numericFields) {
    const localVal = local[field];
    const remoteVal = remote[field];

    if (
      typeof localVal === "number" &&
      typeof remoteVal === "number" &&
      localVal !== remoteVal
    ) {
      // Use the larger value (more conservative estimate)
      (merged as any)[field] = Math.max(localVal, remoteVal);
    }
  }

  return merged;
}

