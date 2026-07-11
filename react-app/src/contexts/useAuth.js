import { useContext } from "react";
import { AuthContext } from "./authContextObject.js";

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth は AuthProvider の内側で使ってください");
  }
  return context;
}
