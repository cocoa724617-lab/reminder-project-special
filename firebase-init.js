import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCHf5uiktc7MJIQ2oWopYoMTYyfS7CwkIw",
  authDomain: "reminder-project-4b576.firebaseapp.com",
  projectId: "reminder-project-4b576",
  storageBucket: "reminder-project-4b576.firebasestorage.app",
  messagingSenderId: "590449260772",
  appId: "1:590449260772:web:c3b859071d04abdcaf94f1",
  measurementId: "G-2364V1ENYR"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
