import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "kodassery-diaries",
  appId: "1:205141759765:web:9cd80b4f8b396aab56bb1c",
  storageBucket: "kodassery-diaries.firebasestorage.app",
  apiKey: "AIzaSyCfyEd8nPvKdc21_5HBPiLTzZoqCsu-e-w",
  authDomain: "kodassery-diaries.firebaseapp.com",
  messagingSenderId: "205141759765",
  measurementId: "G-PY4X8E5BMF",
  projectNumber: "205141759765",
  version: "2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app, "kodassery-db");

export default app;
