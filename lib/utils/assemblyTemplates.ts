/**
 * Assembly Templates Utility
 * 
 * Functions for managing custom assembly templates in Firebase
 */

import { 
  getDocument, 
  createDocument, 
  updateDocument, 
  deleteDocument,
  subscribeToCollection,
  getCollectionRef
} from "@/lib/firebase/firestore";
import { AssemblyTemplate } from "@/lib/data/miscMetalsAssemblies";

const COLLECTION_NAME = "assemblyTemplates";

/**
 * Get path for assembly templates collection
 */
function getTemplatesPath(companyId: string): string {
  return `companies/${companyId}/${COLLECTION_NAME}`;
}

/**
 * Load all custom assembly templates for a company
 */
export async function loadCustomTemplates(companyId: string): Promise<AssemblyTemplate[]> {
  try {
    const templatesRef = getCollectionRef(getTemplatesPath(companyId));
    const { getDocs } = await import("firebase/firestore");
    const snapshot = await getDocs(templatesRef);
    
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as AssemblyTemplate[];
  } catch (error) {
    console.error("Error loading custom templates:", error);
    return [];
  }
}

/**
 * Load custom templates for a specific subtype
 */
export async function loadCustomTemplatesForSubtype(
  companyId: string,
  miscSubtype: string
): Promise<AssemblyTemplate[]> {
  const allTemplates = await loadCustomTemplates(companyId);
  return allTemplates.filter(t => t.miscSubtype === miscSubtype && t.isCustom);
}

/**
 * Save a custom assembly template
 */
export async function saveCustomTemplate(
  companyId: string,
  template: Omit<AssemblyTemplate, "id" | "createdAt" | "updatedAt">,
  userId?: string
): Promise<string> {
  try {
    const templateData = {
      ...template,
      isCustom: true,
      companyId,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const docRef = await createDocument(getTemplatesPath(companyId), templateData);
    return docRef;
  } catch (error) {
    console.error("Error saving custom template:", error);
    throw error;
  }
}

/**
 * Update a custom assembly template
 */
export async function updateCustomTemplate(
  companyId: string,
  templateId: string,
  updates: Partial<AssemblyTemplate>
): Promise<void> {
  try {
    await updateDocument(
      `${getTemplatesPath(companyId)}/${templateId}`,
      {
        ...updates,
        updatedAt: new Date(),
      }
    );
  } catch (error) {
    console.error("Error updating custom template:", error);
    throw error;
  }
}

/**
 * Delete a custom assembly template
 */
export async function deleteCustomTemplate(
  companyId: string,
  templateId: string
): Promise<void> {
  try {
    await deleteDocument(`${getTemplatesPath(companyId)}/${templateId}`);
  } catch (error) {
    console.error("Error deleting custom template:", error);
    throw error;
  }
}

/**
 * Subscribe to custom templates for a company
 */
export function subscribeToCustomTemplates(
  companyId: string,
  callback: (templates: AssemblyTemplate[]) => void
): () => void {
  return subscribeToCollection(
    getTemplatesPath(companyId),
    (snapshot) => {
      const templates = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as AssemblyTemplate[];
      callback(templates);
    }
  );
}

