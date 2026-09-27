import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDvd4mDJMH-yAJImmLx52G9oArjITR5sN4",
  authDomain: "smart-city-f233f.firebaseapp.com",
  projectId: "smart-city-f233f",
  storageBucket: "smart-city-f233f.firebasestorage.app",
  messagingSenderId: "673801422316",
  appId: "1:673801422316:web:813e1bdd7b1c5937d02cc9",
  measurementId: "G-V5Q9FEQ768"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);