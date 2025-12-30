import { useState, useEffect } from "react";
import { 
  User, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Development bypass: Set NEXT_PUBLIC_BYPASS_AUTH=true in .env.local to bypass authentication
  // ONLY works in development mode - NEVER in production
  const bypassAuth = 
    process.env.NEXT_PUBLIC_BYPASS_AUTH === "true" && 
    process.env.NODE_ENV === "development" &&
    typeof window !== "undefined"; // Additional safety check - only in browser

  useEffect(() => {
    if (bypassAuth) {
      // Create a mock user object for development
      const mockUser = {
        uid: "dev-user",
        email: "dev@quant.com",
        displayName: "Dev User",
      } as User;
      setUser(mockUser);
      setLoading(false);
      return;
    }

    if (!auth) {
      // CRITICAL SECURITY: If Firebase auth is not configured, ensure no user is set
      // This prevents unauthorized access when Firebase is not set up
      setUser(null);
      setLoading(false);
      if (typeof window !== "undefined") {
        console.warn("Firebase Auth is not configured. Authentication is required.");
      }
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // Only set user if auth is properly configured
      setUser(user);
      setLoading(false);
    }, (error) => {
      // On auth error, ensure no user is set
      console.error("Auth state error:", error);
      setUser(null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [bypassAuth]);

  const signIn = async (email: string, password: string) => {
    if (!auth) {
      throw new Error("Firebase is not configured. Please set up Firebase credentials.");
    }
    return await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string) => {
    if (!auth) {
      throw new Error("Firebase is not configured. Please set up Firebase credentials.");
    }
    return await createUserWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    if (!auth) {
      throw new Error("Firebase is not configured. Please set up Firebase credentials.");
    }
    return await firebaseSignOut(auth);
  };

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  };
}

