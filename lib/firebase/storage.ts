/**
 * Firebase Storage Utilities
 * Handles file uploads to Firebase Storage
 */

import { storage, isFirebaseConfigured } from "./config";
import { ref, uploadBytes, getDownloadURL, deleteObject, uploadBytesResumable } from "firebase/storage";

/**
 * Check if Firebase Storage is properly configured
 */
export function isStorageConfigured(): boolean {
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  return !!(isFirebaseConfigured() && storage && storageBucket && storageBucket.length > 0);
}

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
  // Check storage bucket configuration
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!storageBucket || storageBucket.length === 0) {
    throw new Error("Firebase Storage bucket is not configured. Please set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in your environment.");
  }

  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Please check your environment variables.");
  }
  
  if (!storage) {
    throw new Error("Firebase Storage is not initialized. This may be a server-side rendering issue.");
  }

  console.log(`[Storage] Starting upload to: ${path}`);
  console.log(`[Storage] File size: ${file.size} bytes, type: ${file.type}`);
  console.log(`[Storage] Storage bucket: ${storageBucket}`);

  return new Promise((resolve, reject) => {
    try {
      const storageRef = ref(storage, path);
      
      // Use resumable upload for better reliability and progress tracking
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          // Track upload progress
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`[Storage] Upload progress: ${progress.toFixed(1)}%`);
        },
        (error) => {
          // Handle upload errors
          console.error("[Storage] Upload failed:", error);
          
          let errorMessage = "Failed to upload file";
          
          switch (error.code) {
            case "storage/unauthorized":
              errorMessage = "Permission denied. Please check Firebase Storage security rules.";
              break;
            case "storage/canceled":
              errorMessage = "Upload was canceled.";
              break;
            case "storage/unknown":
              errorMessage = "An unknown error occurred. Please check your internet connection.";
              break;
            case "storage/quota-exceeded":
              errorMessage = "Storage quota exceeded. Please contact support.";
              break;
            case "storage/invalid-url":
              errorMessage = "Invalid storage URL. Please check Firebase configuration.";
              break;
            case "storage/retry-limit-exceeded":
              errorMessage = "Upload failed after multiple retries. Please check your connection.";
              break;
            case "storage/invalid-checksum":
              errorMessage = "File was corrupted during upload. Please try again.";
              break;
            case "storage/server-file-wrong-size":
              errorMessage = "Upload failed - file size mismatch. Please try again.";
              break;
            default:
              errorMessage = `Upload failed: ${error.message || error.code || "Unknown error"}`;
          }
          
          reject(new Error(errorMessage));
        },
        async () => {
          // Upload completed successfully
          try {
            console.log("[Storage] Upload complete, getting download URL...");
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log("[Storage] Download URL obtained successfully");
            resolve(downloadURL);
          } catch (urlError: any) {
            console.error("[Storage] Failed to get download URL:", urlError);
            reject(new Error(`Upload succeeded but failed to get download URL: ${urlError.message}`));
          }
        }
      );
    } catch (error: any) {
      console.error("[Storage] Failed to start upload:", error);
      reject(new Error(`Failed to start upload: ${error.message || "Unknown error"}`));
    }
  });
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




