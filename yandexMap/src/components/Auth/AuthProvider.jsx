import { useState } from "react";
import { AuthContext } from "./AuthContext";
import { API_URL } from "../../config.js";

function readUserFromStorage() {
  const userStr = localStorage.getItem("user");
  if (!userStr) return null;
  try {
    const u = JSON.parse(userStr);
    if (!u || typeof u !== "object") return null;
    return {
      ...u,
      is_moderator: Boolean(u.is_moderator),
      is_admin: Boolean(u.is_admin),
    };
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => readUserFromStorage());

  const login = async (email, password) => {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) throw new Error("Login failed");

    const data = await res.json();

    const normalized = data.user
      ? {
          ...data.user,
          is_moderator: Boolean(data.user.is_moderator),
          is_admin: Boolean(data.user.is_admin),
        }
      : null;
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(normalized));
    setUser(normalized);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};