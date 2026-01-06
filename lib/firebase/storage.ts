/**
 * Firebase Storage Utilities
 * Handles file uploads to Firebase Storage using Firebase SDK only
 * No direct XMLHttpRequest/fetch calls - all operations use Firebase Storage SDK
 */

import { storage, isFirebaseConfigured, app } from "./config";
import { ref, getDownloadURL, deleteObject, uploadBytesResumable, StorageError } from "firebase/storage";

/**
 * Check if Firebase Storage is properly configured
 */
export function isStorageConfigured(): boolean {
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  return !!(isFirebaseConfigured() && storage && storageBucket && storageBucket.length > 0);
}

/**
 * Upload a file to Firebase Storage using Firebase SDK only
 * Uses uploadBytesResumable with proper metadata configuration
 * @param file - The file to upload
 * @param path - Storage path (e.g., "companies/{companyId}/branding/logo_{timestamp}_{filename}")
 * @param timeoutMs - Optional timeout in milliseconds (default: 60000 = 60 seconds)
 * @returns Download URL of the uploaded file
 */
export async function uploadFileToStorage(
  file: File,
  path: string,
  timeoutMs: number = 60000
): Promise<string> {
  // Check storage bucket configuration
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!storageBucket || storageBucket.length === 0) {
    const error = new Error("Firebase Storage bucket is not configured. Please set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in your environment.");
    console.error("[Storage] Configuration error:", error.message);
    throw error;
  }

  if (!isFirebaseConfigured() || !app) {
    const error = new Error("Firebase is not configured. Please check your environment variables.");
    console.error("[Storage] Configuration error:", error.message);
    throw error;
  }
  
  if (!storage) {
    const error = new Error("Firebase Storage is not initialized. This may be a server-side rendering issue.");
    console.error("[Storage] Initialization error:", error.message);
    throw error;
  }

  // Validate file size (max 5MB for logos, 50MB for others)
  const maxSize = path.includes('/logo/') || path.includes('/branding/') ? 5 * 1024 * 1024 : 50 * 1024 * 1024;
  if (file.size > maxSize) {
    const error = new Error(`File size exceeds maximum allowed size (${Math.round(maxSize / 1024 / 1024)}MB). Please use a smaller file.`);
    console.error("[Storage] Validation error:", error.message);
    throw error;
  }

  console.log(`[Storage] Starting upload using Firebase SDK`);
  console.log(`[Storage] Path: ${path}`);
  console.log(`[Storage] File: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);
  console.log(`[Storage] Bucket: ${storageBucket}`);

  // Create upload promise using Firebase SDK only
  let uploadTask: ReturnType<typeof uploadBytesResumable> | null = null;
  let timeoutId: NodeJS.Timeout | null = null;
  
  const uploadPromise = new Promise<string>((resolve, reject) => {
    let isResolved = false;

    try {
      // Use Firebase Storage SDK - create reference
      const fileRef = ref(storage, path);
      
      // Use uploadBytesResumable with metadata
      uploadTask = uploadBytesResumable(fileRef, file, {
        contentType: file.type,
        cacheControl: "public,max-age=31536000", // Cache for 1 year
      });
      
      // Monitor upload progress
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`[Storage] Upload progress: ${progress.toFixed(1)}%`);
        },
        (error: StorageError) => {
          if (isResolved) return;
          isResolved = true;
          
          // Clear timeout if error occurs
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          
          // Robust error logging
          console.error("[Storage] Upload failed");
          console.error("[Storage] Error code:", error.code);
          console.error("[Storage] Error message:", error.message);
          console.error("[Storage] Full error:", error);
          
          // Check for CORS errors
          const isCorsError = 
            error.code === "storage/unknown" ||
            error.message?.toLowerCase().includes("cors") ||
            error.message?.toLowerCase().includes("cross-origin") ||
            error.message?.toLowerCase().includes("blocked");
          
          let errorMessage = "Failed to upload file";
          
          if (isCorsError) {
            errorMessage = "CORS_ERROR"; // Special marker for CORS errors
          } else {
            switch (error.code) {
              case "storage/unauthorized":
                errorMessage = "Permission denied. Please check Firebase Storage security rules.";
                break;
              case "storage/canceled":
                errorMessage = "Upload was canceled.";
                break;
              case "storage/unknown":
                errorMessage = "An unknown error occurred. This may be a CORS issue.";
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
          }
          
          reject(new Error(errorMessage));
        },
        async () => {
          if (isResolved) return;
          
          // Clear timeout on success
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          
          // Upload completed successfully - get download URL using Firebase SDK
          try {
            console.log("[Storage] Upload complete, getting download URL using Firebase SDK...");
            if (!uploadTask) {
              throw new Error("Upload task is null");
            }
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log("[Storage] Download URL obtained successfully:", downloadURL);
            isResolved = true;
            resolve(downloadURL);
          } catch (urlError: any) {
            if (isResolved) return;
            isResolved = true;
            console.error("[Storage] Failed to get download URL");
            console.error("[Storage] Error code:", urlError.code);
            console.error("[Storage] Error message:", urlError.message);
            console.error("[Storage] Full error:", urlError);
            reject(new Error(`Upload succeeded but failed to get download URL: ${urlError.message || urlError.code || "Unknown error"}`));
          }
        }
      );
    } catch (error: any) {
      if (isResolved) return;
      isResolved = true;
      console.error("[Storage] Failed to start upload");
      console.error("[Storage] Error:", error);
      reject(new Error(`Failed to start upload: ${error.message || "Unknown error"}`));
    }
  });

  // Create timeout promise that cancels upload on timeout
  const timeoutPromise = new Promise<string>((_, reject) => {
    timeoutId = setTimeout(() => {
      console.warn(`[Storage] Upload timeout after ${timeoutMs / 1000} seconds, canceling...`);
      // Cancel the upload task if it exists
      if (uploadTask) {
        try {
          uploadTask.cancel();
        } catch (cancelError) {
          console.warn("[Storage] Failed to cancel upload task:", cancelError);
        }
      }
      reject(new Error("TIMEOUT_ERROR")); // Special marker for timeout
    }, timeoutMs);
  });

  // Race between upload and timeout
  try {
    const result = await Promise.race([uploadPromise, timeoutPromise]);
    // Clear timeout if upload succeeded
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    return result;
  } catch (error: any) {
    // Ensure timeout is cleared on error
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    throw error;
  }
}

/**
 * Delete a file from Firebase Storage using Firebase SDK
 * @param path - Storage path of the file to delete (or full download URL)
 */
export async function deleteFileFromStorage(path: string): Promise<void> {
  if (!isFirebaseConfigured() || !storage) {
    console.error("[Storage] Delete failed: Firebase Storage not configured");
    throw new Error("Firebase Storage is not configured");
  }

  try {
    // If path is a full URL, extract the path
    let storagePath = path;
    if (path.includes('firebasestorage.googleapis.com')) {
      // Extract path from URL: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media
      const urlMatch = path.match(/\/o\/([^?]+)/);
      if (urlMatch) {
        storagePath = decodeURIComponent(urlMatch[1]);
      }
    }

    console.log("[Storage] Deleting file from path:", storagePath);
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
    console.log("[Storage] File deleted successfully");
  } catch (error: any) {
    console.error("[Storage] Delete failed");
    console.error("[Storage] Error code:", error.code);
    console.error("[Storage] Error message:", error.message);
    console.error("[Storage] Full error:", error);
    throw new Error(`Failed to delete file: ${error.message || error.code || "Unknown error"}`);
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




