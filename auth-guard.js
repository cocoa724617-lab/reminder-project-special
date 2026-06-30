import { auth } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

export function requireAuth() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        location.href = "login.html";
        return;
      }
      document.documentElement.classList.remove("auth-checking");
      resolve(user);
    });
  });
}

export async function logout() {
  await signOut(auth);
  location.href = "login.html";
}
