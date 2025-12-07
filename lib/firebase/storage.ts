/**
 * Firebase Storage Utilities
 * Handles file uploads to Firebase Storage
 */

import { storage, isFirebaseConfigured } from "./config";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

/**
 * Upload a file to Firebase Storage
 * @param file - The file to upload
 * @param path - Storage path (e.g., "specs/{companyId}/{projectId}/{filename}")
 * @returns Download URL of the uploaded file
 */
export async function uploadFileToStorage(
  file: File,
  path: string
): Promise<string> {
  if (!isFirebaseConfigured() || !storage) {
    throw new Error("Firebase Storage is not configured");
  }

  try {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error: any) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

/**
 * Delete a file from Firebase Storage
 * @param path - Storage path of the file to delete
 */
export async function deleteFileFromStorage(path: string): Promise<void> {
  if (!isFirebaseConfigured() || !storage) {
    throw new Error("Firebase Storage is not configured");
  }

  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error: any) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Get download URL for a file in Firebase Storage
 * @param path - Storage path of the file
 * @returns Download URL
 */
export async function getFileDownloadURL(path: string): Promise<string> {
  if (!isFirebaseConfigured() || !storage) {
    throw new Error("Firebase Storage is not configured");
  }

  try {
    const storageRef = ref(storage, path);
    return await getDownloadURL(storageRef);
  } catch (error: any) {
    throw new Error(`Failed to get download URL: ${error.message}`);
  }
}


