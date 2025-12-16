/**
 * Utility to create a default admin user for development/testing
 * This should be called once during initial setup
 */

import { createUserWithEmailAndPassword, updateProfile, getAuth } from "firebase/auth";
import { initializeApp, getApps } from "firebase/app";
import { setDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";

// Initialize Firebase for server-side use
const getServerAuth = () => {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  if (!isFirebaseConfigured()) {
    return null;
  }

  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return getAuth(app);
};

const ROLE_PERMISSIONS = {
  admin: {
    canCreateProjects: true,
    canEditProjects: true,
    canDeleteProjects: true,
    canViewReports: true,
    canManageUsers: true,
  },
  estimator: {
    canCreateProjects: true,
    canEditProjects: true,
    canDeleteProjects: false,
    canViewReports: true,
    canManageUsers: false,
  },
  viewer: {
    canCreateProjects: false,
    canEditProjects: false,
    canDeleteProjects: false,
    canViewReports: true,
    canManageUsers: false,
  },
};

export async function createDefaultAdmin(companyId: string = "default") {
  if (!isFirebaseConfigured()) {
    console.error("Firebase not configured. Cannot create admin user.");
    return { success: false, error: "Firebase not configured" };
  }

  const auth = getServerAuth();
  if (!auth) {
    return { success: false, error: "Failed to initialize Firebase Auth" };
  }

  const adminEmail = "admin@quant.com";
  const adminPassword = "admin";
  const adminName = "Admin User";

  try {
    // Check if user already exists
    try {
      // Try to sign in first to check if user exists
      const { signInWithEmailAndPassword } = await import("firebase/auth");
      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      console.log("Admin user already exists");
      return { success: true, message: "Admin user already exists" };
    } catch (signInError: any) {
      // User doesn't exist, create it
      if (signInError.code === "auth/user-not-found" || signInError.code === "auth/wrong-password") {
        // Create new user
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          adminEmail,
          adminPassword
        );

        const user = userCredential.user;

        // Update user profile
        await updateProfile(user, {
          displayName: adminName,
        });

        // Create member document
        const memberPath = `companies/${companyId}/members/${user.uid}`;
        await setDocument(
          memberPath,
          {
            userId: user.uid,
            email: adminEmail,
            name: adminName,
            role: "admin",
            permissions: ROLE_PERMISSIONS.admin,
            status: "active",
            joinedAt: new Date(),
          },
          false
        );

        console.log("Default admin user created successfully");
        return { 
          success: true, 
          message: "Admin user created",
          userId: user.uid,
          email: adminEmail,
          password: adminPassword,
        };
      } else {
        throw signInError;
      }
    }
  } catch (error: any) {
    console.error("Failed to create admin user:", error);
    return { 
      success: false, 
      error: error.message || "Failed to create admin user" 
    };
  }
}

/**
 * Call this function on app initialization to ensure admin user exists
 * Can be called from a setup page or on first load
 */
export async function ensureDefaultAdmin(companyId: string = "default") {
  return await createDefaultAdmin(companyId);
}

