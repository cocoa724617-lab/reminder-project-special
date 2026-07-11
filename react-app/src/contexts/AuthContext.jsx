import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../services/firebase.js";
import { AuthContext } from "./authContextObject.js";

// Firebase Authentication の状態を全画面から参照できるようにするプロバイダー。
// currentUser / isLoading / logout をまとめて配る。
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  function logout() {
    return signOut(auth);
  }

  const value = { currentUser, isLoading, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
