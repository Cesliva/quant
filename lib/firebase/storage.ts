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
 * Upload a file to Firebase Storage with timeout protection
 * @param file - The file to upload
 * @param path - Storage path (e.g., "specs/{companyId}/{projectId}/{filename}")
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
    throw new Error("Firebase Storage bucket is not configured. Please set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in your environment.");
  }

  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Please check your environment variables.");
  }
  
  if (!storage) {
    throw new Error("Firebase Storage is not initialized. This may be a server-side rendering issue.");
  }

  // Validate file size (max 10MB for logos, but allow larger for other files)
  const maxSize = path.includes('/logo/') ? 5 * 1024 * 1024 : 50 * 1024 * 1024; // 5MB for logos, 50MB for others
  if (file.size > maxSize) {
    throw new Error(`File size exceeds maximum allowed size (${Math.round(maxSize / 1024 / 1024)}MB). Please use a smaller file.`);
  }

  console.log(`[Storage] Starting upload to: ${path}`);
  console.log(`[Storage] File size: ${file.size} bytes, type: ${file.type}`);
  console.log(`[Storage] Storage bucket: ${storageBucket}`);
  console.log(`[Storage] Timeout: ${timeoutMs}ms`);

  // Create upload promise with cancellation support
  let uploadTask: any = null;
  let timeoutId: NodeJS.Timeout | null = null;
  
  const uploadPromise = new Promise<string>((resolve, reject) => {
    let isResolved = false;

    try {
      const storageRef = ref(storage, path);
      
      // Use resumable upload for better reliability and progress tracking
      uploadTask = uploadBytesResumable(storageRef, file);
      
      uploadTask.on(
        "state_changed",
        (snapshot: any) => {
          // Track upload progress
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`[Storage] Upload progress: ${progress.toFixed(1)}%`);
        },
        (error: any) => {
          if (isResolved) return;
          isResolved = true;
          
          // Clear timeout if error occurs
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          
          // Handle upload errors
          console.error("[Storage] Upload failed:", error);
          
          let errorMessage = "Failed to upload file";
          
          // Check for CORS errors specifically
          const errorString = JSON.stringify(error).toLowerCase();
          const isCorsError = errorString.includes('cors') || 
                             errorString.includes('cross-origin') ||
                             error.code === 'storage/unknown' && errorString.includes('blocked');
          
          if (isCorsError) {
            errorMessage = "CORS Error: Firebase Storage is blocking requests. Please configure CORS for your storage bucket. See QUICK_CORS_FIX.md for instructions.";
          } else {
            switch (error.code) {
              case "storage/unauthorized":
                errorMessage = "Permission denied. Please check Firebase Storage security rules.";
                break;
              case "storage/canceled":
                errorMessage = "Upload was canceled.";
                break;
              case "storage/unknown":
                errorMessage = "An unknown error occurred. This may be a CORS issue. Please check your internet connection and Firebase Storage CORS configuration.";
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
          
          // Upload completed successfully
          try {
            console.log("[Storage] Upload complete, getting download URL...");
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log("[Storage] Download URL obtained successfully");
            isResolved = true;
            resolve(downloadURL);
          } catch (urlError: any) {
            if (isResolved) return;
            isResolved = true;
            console.error("[Storage] Failed to get download URL:", urlError);
            reject(new Error(`Upload succeeded but failed to get download URL: ${urlError.message}`));
          }
        }
      );
    } catch (error: any) {
      if (isResolved) return;
      isResolved = true;
      console.error("[Storage] Failed to start upload:", error);
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
      reject(new Error(`Upload timed out after ${timeoutMs / 1000} seconds. This is often caused by CORS configuration issues. Please check your Firebase Storage CORS settings. See QUICK_CORS_FIX.md for instructions.`));
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
  } catch (error) {
    // Ensure timeout is cleared on error
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    throw error;
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




