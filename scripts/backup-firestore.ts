/**
 * Firestore Backup Script
 * 
 * Exports all Firestore data to JSON files that can be committed to Git.
 * 
 * Usage: npm run backup:firestore
 */

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc, query, limit } from "firebase/firestore";
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

interface BackupData {
  [collectionName: string]: {
    [documentId: string]: any;
  };
}

/**
 * Recursively get all subcollections for a document
 */
async function getSubcollections(
  parentPath: string,
  maxDepth: number = 5,
  currentDepth: number = 0
): Promise<any> {
  if (currentDepth >= maxDepth) {
    return {};
  }

  const subcollections: any = {};
  
  try {
    // List subcollections (this is a workaround since Firestore doesn't have a direct API)
    // We'll need to know the structure or try common patterns
    const commonSubcollections = [
      "projects",
      "members",
      "settings",
      "comments",
      "files",
      "estimatingLines",
      "activityLog",
      "notifications",
    ];

    for (const subcolName of commonSubcollections) {
      try {
        const subcolRef = collection(db, `${parentPath}/${subcolName}`);
        const subcolSnapshot = await getDocs(query(subcolRef, limit(1000)));
        
        if (!subcolSnapshot.empty) {
          subcollections[subcolName] = {};
          for (const subDoc of subcolSnapshot.docs) {
            const subDocData = subDoc.data();
            // Convert Firestore timestamps to ISO strings
            const cleanedData = cleanFirestoreData(subDocData);
            subcollections[subcolName][subDoc.id] = cleanedData;
            
            // Recursively get nested subcollections
            const nested = await getSubcollections(
              `${parentPath}/${subcolName}/${subDoc.id}`,
              maxDepth,
              currentDepth + 1
            );
            if (Object.keys(nested).length > 0) {
              subcollections[subcolName][subDoc.id]._subcollections = nested;
            }
          }
        }
      } catch (error) {
        // Collection doesn't exist or access denied, skip
        continue;
      }
    }
  } catch (error) {
    console.warn(`Could not get subcollections for ${parentPath}:`, error);
  }

  return subcollections;
}

/**
 * Clean Firestore data by converting Timestamps to ISO strings
 */
function cleanFirestoreData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (data.toDate && typeof data.toDate === "function") {
    // Firestore Timestamp
    return data.toDate().toISOString();
  }

  if (data.toMillis && typeof data.toMillis === "function") {
    // Firestore Timestamp (alternative)
    return new Date(data.toMillis()).toISOString();
  }

  if (Array.isArray(data)) {
    return data.map(cleanFirestoreData);
  }

  if (typeof data === "object") {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(data)) {
      cleaned[key] = cleanFirestoreData(value);
    }
    return cleaned;
  }

  return data;
}

/**
 * Backup a collection and all its documents
 */
async function backupCollection(collectionName: string): Promise<any> {
  console.log(`📦 Backing up collection: ${collectionName}`);
  
  const collectionRef = collection(db, collectionName);
  const snapshot = await getDocs(query(collectionRef, limit(10000)));
  
  const collectionData: any = {};
  let docCount = 0;

  for (const docSnapshot of snapshot.docs) {
    const docData = docSnapshot.data();
    const cleanedData = cleanFirestoreData(docData);
    
    // Get subcollections
    const subcollections = await getSubcollections(
      `${collectionName}/${docSnapshot.id}`
    );
    
    if (Object.keys(subcollections).length > 0) {
      cleanedData._subcollections = subcollections;
    }
    
    collectionData[docSnapshot.id] = cleanedData;
    docCount++;
  }

  console.log(`   ✅ Backed up ${docCount} documents`);
  return collectionData;
}

/**
 * Main backup function
 */
async function backupFirestore() {
  console.log("🚀 Starting Firestore backup...\n");

  const backupDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
  const backupFile = path.join(backupDir, `firestore-backup-${timestamp}.json`);

  const backup: BackupData = {};

  // Main collections to backup
  const mainCollections = ["companies"];

  for (const collectionName of mainCollections) {
    try {
      backup[collectionName] = await backupCollection(collectionName);
    } catch (error) {
      console.error(`❌ Error backing up ${collectionName}:`, error);
    }
  }

  // Write backup to file
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
  
  console.log(`\n✅ Backup completed successfully!`);
  console.log(`📁 Backup saved to: ${backupFile}`);
  console.log(`📊 Total collections: ${Object.keys(backup).length}`);
  
  // Also create a "latest" symlink/copy
  const latestFile = path.join(backupDir, "firestore-backup-latest.json");
  fs.copyFileSync(backupFile, latestFile);
  console.log(`🔗 Latest backup: ${latestFile}\n`);

  process.exit(0);
}

// Run backup
backupFirestore().catch((error) => {
  console.error("❌ Backup failed:", error);
  process.exit(1);
});






