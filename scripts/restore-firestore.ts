/**
 * Firestore Restore Script
 * 
 * Restores Firestore data from JSON backup files.
 * 
 * Usage: npm run restore:firestore [backup-file]
 * Example: npm run restore:firestore backups/firestore-backup-latest.json
 */

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
require("dotenv").config({ path: ".env.local" });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Convert ISO string dates back to Firestore Timestamps
 */
function restoreFirestoreData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  // Check if it's an ISO date string
  if (typeof data === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(data)) {
    try {
      return new Date(data);
    } catch {
      return data;
    }
  }

  if (Array.isArray(data)) {
    return data.map(restoreFirestoreData);
  }

  if (typeof data === "object" && !data._subcollections) {
    const restored: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (key !== "_subcollections") {
        restored[key] = restoreFirestoreData(value);
      }
    }
    return restored;
  }

  return data;
}

/**
 * Restore a document and its subcollections
 */
async function restoreDocument(
  collectionPath: string,
  docId: string,
  data: any,
  subcollections?: any
) {
  const docRef = doc(db, `${collectionPath}/${docId}`);
  const cleanedData = restoreFirestoreData(data);
  
  // Remove _subcollections from main document data
  delete cleanedData._subcollections;
  
  await setDoc(docRef, cleanedData, { merge: true });

  // Restore subcollections
  if (subcollections) {
    for (const [subcolName, subcolData] of Object.entries(subcollections)) {
      if (typeof subcolData === "object") {
        for (const [subDocId, subDocData] of Object.entries(subcolData as any)) {
          if (typeof subDocData === "object") {
            const subDocSubcollections = (subDocData as any)._subcollections;
            await restoreDocument(
              `${collectionPath}/${docId}/${subcolName}`,
              subDocId,
              subDocData,
              subDocSubcollections
            );
          }
        }
      }
    }
  }
}

/**
 * Restore a collection
 */
async function restoreCollection(collectionName: string, collectionData: any) {
  console.log(`📦 Restoring collection: ${collectionName}`);
  
  let docCount = 0;
  const batch = writeBatch(db);
  let batchCount = 0;
  const BATCH_SIZE = 500; // Firestore batch limit

  for (const [docId, docData] of Object.entries(collectionData)) {
    if (typeof docData === "object") {
      const subcollections = (docData as any)._subcollections;
      const docRef = doc(db, `${collectionName}/${docId}`);
      const cleanedData = restoreFirestoreData(docData);
      delete cleanedData._subcollections;
      
      batch.set(docRef, cleanedData, { merge: true });
      batchCount++;
      docCount++;

      // Commit batch if we hit the limit
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batchCount = 0;
      }

      // Restore subcollections after main document
      if (subcollections) {
        for (const [subcolName, subcolData] of Object.entries(subcollections)) {
          if (typeof subcolData === "object") {
            for (const [subDocId, subDocData] of Object.entries(subcolData as any)) {
              if (typeof subDocData === "object") {
                const subDocSubcollections = (subDocData as any)._subcollections;
                await restoreDocument(
                  `${collectionName}/${docId}/${subcolName}`,
                  subDocId,
                  subDocData,
                  subDocSubcollections
                );
              }
            }
          }
        }
      }
    }
  }

  // Commit remaining batch
  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`   ✅ Restored ${docCount} documents`);
}

/**
 * Main restore function
 */
async function restoreFirestore(backupFile: string) {
  if (!fs.existsSync(backupFile)) {
    console.error(`❌ Backup file not found: ${backupFile}`);
    process.exit(1);
  }

  console.log("🚀 Starting Firestore restore...\n");
  console.log(`📁 Reading backup from: ${backupFile}\n`);

  const backupData = JSON.parse(fs.readFileSync(backupFile, "utf-8"));

  for (const [collectionName, collectionData] of Object.entries(backupData)) {
    try {
      await restoreCollection(collectionName, collectionData as any);
    } catch (error) {
      console.error(`❌ Error restoring ${collectionName}:`, error);
    }
  }

  console.log(`\n✅ Restore completed successfully!`);
  process.exit(0);
}

// Get backup file from command line argument
const backupFile = process.argv[2] || path.join(process.cwd(), "backups", "firestore-backup-latest.json");

if (!backupFile) {
  console.error("❌ Please provide a backup file path");
  console.log("Usage: npm run restore:firestore [backup-file]");
  process.exit(1);
}

// Run restore
restoreFirestore(backupFile).catch((error) => {
  console.error("❌ Restore failed:", error);
  process.exit(1);
});

