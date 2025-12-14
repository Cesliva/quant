/**
 * Script to fix owner access for existing user
 * 
 * Usage:
 * 1. Get your Firebase Auth UID (from Firebase Console → Authentication)
 * 2. Get your company ID (from Firestore companies collection)
 * 3. Run: ts-node scripts/fix-owner-access.ts <companyId> <userId> <email> <name>
 * 
 * Example:
 * ts-node scripts/fix-owner-access.ts abc123 user456 user@example.com "Your Name"
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Get command line arguments
const args = process.argv.slice(2);
if (args.length < 4) {
  console.error("Usage: ts-node scripts/fix-owner-access.ts <companyId> <userId> <email> <name>");
  process.exit(1);
}

const [companyId, userId, email, name] = args;

// Initialize Firebase Admin (requires service account)
// You'll need to set GOOGLE_APPLICATION_CREDENTIALS or use environment variables
async function fixOwnerAccess() {
  try {
    // Initialize Firebase Admin
    // Note: You may need to set up service account credentials
    // See: https://firebase.google.com/docs/admin/setup
    
    const app = initializeApp();
    const db = getFirestore(app);

    console.log(`Fixing owner access for user ${userId} in company ${companyId}...`);

    // 1. Update company document to set ownerId
    const companyRef = db.doc(`companies/${companyId}`);
    await companyRef.set(
      {
        ownerId: userId,
      },
      { merge: true }
    );
    console.log("✅ Set ownerId in company document");

    // 2. Create/update member document with owner role
    const memberRef = db.doc(`companies/${companyId}/members/${userId}`);
    await memberRef.set(
      {
        userId: userId,
        email: email,
        name: name,
        role: "owner",
        permissions: {
          canCreateProjects: true,
          canEditProjects: true,
          canDeleteProjects: true,
          canViewReports: true,
          canManageUsers: true,
          canAccessSettings: true,
        },
        status: "active",
        joinedAt: new Date(),
      },
      { merge: true }
    );
    console.log("✅ Created/updated member document with owner role");

    console.log("\n✅ Owner access fixed! Refresh your browser to see changes.");
  } catch (error) {
    console.error("❌ Error fixing owner access:", error);
    console.error("\nAlternative: Use Firebase Console to manually set:");
    console.error(`1. companies/${companyId}/ownerId = ${userId}`);
    console.error(`2. companies/${companyId}/members/${userId}/role = "owner"`);
    process.exit(1);
  }
}

fixOwnerAccess();


