import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check if Firebase config is valid (not placeholder values)
const isFirebaseConfigured = () => {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  return (
    apiKey &&
    apiKey !== "test_key_for_ui_testing" &&
    apiKey !== "test_key" &&
    apiKey.length > 10 &&
    !apiKey.includes("your_") &&
    !apiKey.includes("placeholder")
  );
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

// Initialize Firebase (works in both browser and server)
function initializeFirebase() {
  if (app) return; // Already initialized
  
  try {
    if (isFirebaseConfigured()) {
      app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
      
      // Initialize Firestore (works in both browser and server)
      try {
        db = getFirestore(app);
      } catch (dbError) {
        // Firestore might fail in some server contexts, that's okay
        if (typeof window !== "undefined") {
          console.warn("Firestore initialization warning:", dbError);
        }
      }
      
      // Only initialize auth and storage in browser (they require browser APIs)
      if (typeof window !== "undefined") {
        try {
          auth = getAuth(app);
          storage = getStorage(app);
        } catch (browserError) {
          console.warn("Firebase browser initialization error:", browserError);
        }
      }
    } else {
      // Silently handle missing config - app will run in demo mode
      if (typeof window !== "undefined") {
        console.warn(
          "Firebase is not properly configured. Please set valid Firebase credentials in .env.local"
        );
        console.warn(
          "The app will run in demo mode without Firebase functionality."
        );
      }
    }
  } catch (error) {
    // Don't crash the app if Firebase initialization fails
    if (typeof window !== "undefined") {
      console.error("Firebase initialization error:", error);
      console.warn("The app will run in demo mode without Firebase functionality.");
    }
    // On server, silently fail - API routes will handle their own initialization
  }
}

// Initialize Firebase
initializeFirebase();

export { app, auth, db, storage, isFirebaseConfigured };

