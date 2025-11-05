import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
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
  const docRef = await addDoc(collection(db!, path), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
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

export const updateDocument = async <T extends Partial<DocumentData>>(
  path: string,
  data: T
): Promise<void> => {
  checkFirebase();
  const docRef = doc(db!, path);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
};

export const deleteDocument = async (path: string): Promise<void> => {
  checkFirebase();
  const docRef = doc(db!, path);
  await deleteDoc(docRef);
};

export const queryDocuments = async <T extends DocumentData>(
  path: string,
  constraints: QueryConstraint[] = []
): Promise<T[]> => {
  checkFirebase();
  const q = query(collection(db!, path), ...constraints);
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
  constraints: QueryConstraint[] = []
) => {
  if (!db || !isFirebaseConfigured()) {
    // Return a no-op unsubscribe function if Firebase isn't configured
    console.warn("Firebase not configured - subscribeToCollection is a no-op");
    return () => {};
  }
  
  const q = query(collection(db, path), ...constraints);
  
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as unknown as T[];
    callback(data);
  });
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
  return `companies/${companyId}/projects/${projectId}/${segments.join("/")}`;
};

