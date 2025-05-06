import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBlheEOIloh-KdMnjunhCYoPmOcp5yNlL8",
  authDomain: "smashbook-ae1b0.firebaseapp.com",
  projectId: "smashbook-ae1b0",
  storageBucket: "smashbook-ae1b0.firebasestorage.app",
  messagingSenderId: "32927185315",
  appId: "1:32927185315:web:c2c50f910e61e88b1f0216",
  measurementId: "G-8723ZP12ZL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
