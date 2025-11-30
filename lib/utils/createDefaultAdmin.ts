/**
 * Utility to create a default admin user for development/testing
 * This should be called once during initial setup
 */

import { createUserWithEmailAndPassword, updateProfile, getAuth } from "firebase/auth";
import { initializeApp, getApps } from "firebase/app";
import { setDocument, getDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";

// Initialize Firebase for server-side use
const getServerAuth = () => {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  
  if (!apiKey || !projectId || !authDomain) {
    console.error("Missing Firebase env vars. API Key:", !!apiKey, "Project ID:", !!projectId, "Auth Domain:", !!authDomain);
    return null;
  }
  
  const firebaseConfig = {
    apiKey: apiKey,
    authDomain: authDomain,
    projectId: projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  try {
    console.log("Initializing Firebase with config:", {
      apiKey: `${apiKey.substring(0, 10)}...`,
      projectId: projectId,
      authDomain: authDomain,
    });
    
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const auth = getAuth(app);
    console.log("Firebase Auth initialized successfully");
    return auth;
  } catch (error: any) {
    console.error("Failed to initialize Firebase app:", error);
    console.error("Error details:", error.message, error.code);
    return null;
  }
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
  // Direct check of environment variables (bypass isFirebaseConfigured for server-side)
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  
  // Server-side validation (more lenient than client-side check)
  if (!apiKey || apiKey.length < 10 || apiKey.includes("your_") || apiKey.includes("placeholder")) {
    console.error("Invalid Firebase API Key. Length:", apiKey?.length || 0);
    return { 
      success: false, 
      error: "Firebase API Key is missing or invalid. Please check your .env.local file and restart the dev server." 
    };
  }
  
  if (!projectId || !authDomain) {
    console.error("Missing Firebase config. Project ID:", !!projectId, "Auth Domain:", !!authDomain);
    return { 
      success: false, 
      error: "Firebase configuration incomplete. Please check your .env.local file has all required variables." 
    };
  }

  // Try to get auth - if it fails, provide detailed error
  let auth;
  try {
    auth = getServerAuth();
    if (!auth) {
      // Check what went wrong
      const hasApiKey = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      const hasProjectId = !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      const hasAuthDomain = !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
      
      return { 
        success: false, 
        error: `Failed to initialize Firebase Auth. API Key: ${hasApiKey ? 'present' : 'missing'}, Project ID: ${hasProjectId ? 'present' : 'missing'}, Auth Domain: ${hasAuthDomain ? 'present' : 'missing'}. Please restart the dev server.` 
      };
    }
  } catch (authError: any) {
    console.error("Auth initialization error:", authError);
    return { 
      success: false, 
      error: `Firebase Auth initialization failed: ${authError.message}. Please check your Firebase configuration.` 
    };
  }

  const adminEmail = "admin@quant.com";
  const adminPassword = "admin123";
  const adminName = "Admin User";

  try {
    // Check if user already exists by trying to get user by email
    const { getUserByEmail } = await import("firebase/auth");
    
    // Try to create the user (will fail if user already exists)
    try {
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
        message: "Admin user created successfully",
        userId: user.uid,
        email: adminEmail,
        password: adminPassword,
      };
    } catch (createError: any) {
      // If user already exists, that's fine - just return success
      if (createError.code === "auth/email-already-in-use") {
        console.log("Admin user already exists in Firebase Auth");
        
        // Try to sign in to get the user ID
        try {
          const { signInWithEmailAndPassword } = await import("firebase/auth");
          const userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
          const user = userCredential.user;
          
          // Check if member document exists, create if not
          const memberPath = `companies/${companyId}/members/${user.uid}`;
          
          try {
            const existingMember = await getDocument(memberPath);
            if (!existingMember) {
              // Create member document if it doesn't exist
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
            }
          } catch (docError) {
            // Member doc might not exist, create it
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
          }
          
          return { 
            success: true, 
            message: "Admin user already exists and is ready to use",
            userId: user.uid,
            email: adminEmail,
            password: adminPassword,
          };
        } catch (signInError: any) {
          // User exists but password might be wrong
          if (signInError.code === "auth/wrong-password") {
            return {
              success: false,
              error: "Admin user exists but password is incorrect. Please reset the password in Firebase Console or use a different email.",
            };
          }
          throw signInError;
        }
      } else {
        // Some other error occurred
        throw createError;
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

