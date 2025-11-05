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

if (typeof window !== "undefined") {
  try {
    if (isFirebaseConfigured()) {
      app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
      auth = getAuth(app);
      db = getFirestore(app);
      storage = getStorage(app);
    } else {
      console.warn(
        "Firebase is not properly configured. Please set valid Firebase credentials in .env.local"
      );
      console.warn(
        "The app will run in demo mode without Firebase functionality."
      );
    }
  } catch (error) {
    console.error("Firebase initialization error:", error);
    console.warn("The app will run in demo mode without Firebase functionality.");
  }
}

export { app, auth, db, storage, isFirebaseConfigured };

