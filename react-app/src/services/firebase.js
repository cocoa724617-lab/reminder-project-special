import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 既存の firebase-init.js と同じ Firebase プロジェクトに接続する設定値。
// 元ファイルは CDN の URL import だが、react-app は npm パッケージ (firebase) を
// 使うため、設定値だけをそのままコピーしている。元ファイルは変更しない。
// firebase-init.js 側の設定値を変更した場合は、こちらも合わせて更新すること。
const firebaseConfig = {
  apiKey: "AIzaSyCHf5uiktc7MJIQ2oWopYoMTYyfS7CwkIw",
  authDomain: "reminder-project-4b576.firebaseapp.com",
  projectId: "reminder-project-4b576",
  storageBucket: "reminder-project-4b576.firebasestorage.app",
  messagingSenderId: "590449260772",
  appId: "1:590449260772:web:c3b859071d04abdcaf94f1",
  measurementId: "G-2364V1ENYR",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
