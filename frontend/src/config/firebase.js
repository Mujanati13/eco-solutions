// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Replace with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyBBNf5XUzg1P165KkyAOGVUfJMl3Xn7v-0",
  authDomain: "xcite-fca6c.firebaseapp.com",
  projectId: "xcite-fca6c",
  storageBucket: "xcite-fca6c.firebasestorage.app",
  messagingSenderId: "327413887126",
  appId: "1:327413887126:web:9ef25f8f7fc47a827a12b7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

export default app;
