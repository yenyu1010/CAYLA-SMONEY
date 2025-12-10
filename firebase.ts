import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import * as firebaseAppModule from 'firebase/app';

// Workaround for environment where initializeApp/FirebaseApp are not detected in types
const initializeApp = (firebaseAppModule as any).initializeApp;
type FirebaseApp = any;

// Configuration provided by the user
const defaultFirebaseConfig = {
  apiKey: "AIzaSyAPg9WwIX8VmV4CgDAPAYSrVgCi5c5gRY8",
  authDomain: "sinan-22533.firebaseapp.com",
  projectId: "sinan-22533",
  storageBucket: "sinan-22533.firebasestorage.app",
  messagingSenderId: "701507856234",
  appId: "1:701507856234:web:015074097fce46099c6713",
  measurementId: "G-NZ9EQ2S6DH"
};

// Fallback configuration logic: Window variable > Hardcoded default
const getFirebaseConfig = () => {
  if (typeof window !== 'undefined' && window.__firebase_config) {
    try {
        // Handle case where it might be a stringified JSON or already an object
        return typeof window.__firebase_config === 'string' 
            ? JSON.parse(window.__firebase_config) 
            : window.__firebase_config;
    } catch (e) {
      console.error("Error parsing firebase config", e);
      return defaultFirebaseConfig;
    }
  }
  return defaultFirebaseConfig;
};

const firebaseConfig = getFirebaseConfig();

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

// Initialize only if config is valid (has apiKey) to prevent crash
if (firebaseConfig && firebaseConfig.apiKey) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
} else {
  console.warn("Firebase configuration (apiKey) is missing. App is running in offline mode.");
}

export { auth, db };

export const getAppId = () => {
    if (typeof window !== 'undefined' && window.__app_id) {
        return window.__app_id;
    }
    // Default to the project ID for cleaner data paths
    return 'sinan-22533';
};