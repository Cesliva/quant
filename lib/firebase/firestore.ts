import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  addDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  Timestamp,
  DocumentData,
  QueryConstraint,
  FirestoreDataConverter,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./config";

// Helper function to check if Firebase is available
const checkFirebase = () => {
  if (!db || !isFirebaseConfigured()) {
    throw new Error(
      "Firebase is not configured. Please set valid Firebase credentials in .env.local"
    );
  }
};

// Remove undefined values recursively to prevent Firestore errors
const sanitizeData = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeData(item)) as unknown as T;
  }

  if (value && typeof value === "object" && !(value instanceof Date) && !(value instanceof Timestamp)) {
    const cleaned: Record<string, any> = {};
    Object.entries(value as Record<string, any>).forEach(([key, val]) => {
      const sanitized = sanitizeData(val);
      if (sanitized !== undefined) {
        cleaned[key] = sanitized;
      }
    });
    return cleaned as unknown as T;
  }

  return value;
};

// Helper function to get collection reference
export const getCollectionRef = (path: string) => {
  checkFirebase();
  return collection(db!, path);
};

// Helper function to get document reference
export const getDocRef = (path: string) => {
  checkFirebase();
  return doc(db!, path);
};

// Generic CRUD operations
export const createDocument = async <T extends DocumentData>(
  path: string,
  data: T
): Promise<string> => {
  checkFirebase();
  const docRef = await addDoc(
    collection(db!, path),
    sanitizeData({
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
  );
  return docRef.id;
};

export const getDocument = async <T extends DocumentData>(
  path: string
): Promise<T | null> => {
  checkFirebase();
  const docRef = doc(db!, path);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as unknown as T;
  }
  return null;
};

export const setDocument = async <T extends DocumentData>(
  path: string,
  data: T,
  merge: boolean = true
): Promise<void> => {
  checkFirebase();
  const docRef = doc(db!, path);
  await setDoc(
    docRef,
    sanitizeData({
      ...data,
      updatedAt: Timestamp.now(),
    }),
    { merge }
  );
};

export const updateDocument = async <T extends Partial<DocumentData>>(
  collectionPath: string,
  documentId: string,
  data: T
): Promise<void> => {
  checkFirebase();
  const docRef = doc(collection(db!, collectionPath), documentId);
  await updateDoc(
    docRef,
    sanitizeData({
      ...data,
      updatedAt: Timestamp.now(),
    })
  );
};

export const deleteDocument = async (collectionPath: string, documentId: string): Promise<void> => {
  checkFirebase();
  const docRef = doc(collection(db!, collectionPath), documentId);
  await deleteDoc(docRef);
};

export const queryDocuments = async <T extends DocumentData>(
  path: string,
  constraints: QueryConstraint[] = []
): Promise<T[]> => {
  checkFirebase();
  // Ensure constraints is always an array
  const safeConstraints = Array.isArray(constraints) ? constraints : [];
  const q = query(collection(db!, path), ...safeConstraints);
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as unknown as T[];
};

// Real-time listener
export const subscribeToCollection = <T extends DocumentData>(
  path: string,
  callback: (data: T[]) => void,
  constraintsOrErrorCallback?: QueryConstraint[] | ((error: any) => void),
  errorCallback?: (error: any) => void
) => {
  if (!db || !isFirebaseConfigured()) {
    // Return a no-op unsubscribe function if Firebase isn't configured
    console.warn("Firebase not configured - subscribeToCollection is a no-op");
    return () => {};
  }
  
  // Handle different call signatures:
  // 1. subscribeToCollection(path, callback) - no constraints, no error handler
  // 2. subscribeToCollection(path, callback, constraints) - with constraints
  // 3. subscribeToCollection(path, callback, errorCallback) - with error callback (constraints is function)
  // 4. subscribeToCollection(path, callback, constraints, errorCallback) - with both
  
  let constraints: QueryConstraint[] = [];
  let onError: ((error: any) => void) | undefined;
  
  if (Array.isArray(constraintsOrErrorCallback)) {
    // Third param is constraints array
    constraints = constraintsOrErrorCallback;
    onError = errorCallback;
  } else if (typeof constraintsOrErrorCallback === 'function') {
    // Third param is error callback (no constraints)
    onError = constraintsOrErrorCallback;
    constraints = [];
  } else {
    // No third param
    constraints = [];
    onError = errorCallback;
  }
  
  // Ensure constraints is always an array
  const safeConstraints = Array.isArray(constraints) ? constraints : [];
  const q = query(collection(db, path), ...safeConstraints);
  
  return onSnapshot(
    q, 
    (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as unknown as T[];
      callback(data);
    },
    (error) => {
      if (onError) {
        onError(error);
      } else {
        console.error("Error in subscribeToCollection:", error);
      }
    }
  );
};

// Company-specific helpers
export const getCompanyPath = (companyId: string, ...segments: string[]) => {
  return `companies/${companyId}/${segments.join("/")}`;
};

export const getProjectPath = (
  companyId: string,
  projectId: string,
  ...segments: string[]
) => {
  const basePath = `companies/${companyId}/projects/${projectId}`;
  if (segments.length === 0) {
    return basePath; // No trailing slash when no segments
  }
  return `${basePath}/${segments.join("/")}`;
};

