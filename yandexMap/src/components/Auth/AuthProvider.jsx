import React, { useState } from "react";
import { AuthContext } from "./AuthContext";
import { login as apiLogin, logout as apiLogout } from "../../services/api";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  const login = async (email, password) => {
    const data = await apiLogin(email, password);
    setUser(data.user);
    localStorage.setItem("user", JSON.stringify(data.user));
  };

const logout = async () => {
  try {
    await apiLogout();
  } catch (err) {
    console.warn("Logout error:", err);
  }
  setUser(null);
  localStorage.removeItem("user");
};

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
