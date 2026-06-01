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
      is_department_rep: Boolean(u.is_department_rep),
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
          is_department_rep: Boolean(data.user.is_department_rep),
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

  /** Актуальные роли из БД и новый JWT (после смены прав без повторного логина). */
  const refreshSession = async () => {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const res = await fetch(`${API_URL}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      logout();
      return null;
    }
    if (!res.ok) return null;
    const data = await res.json();
    const normalized = data.user
      ? {
          ...data.user,
          is_moderator: Boolean(data.user.is_moderator),
          is_admin: Boolean(data.user.is_admin),
          is_department_rep: Boolean(data.user.is_department_rep),
        }
      : null;
    if (data.token) {
      localStorage.setItem("token", data.token);
    }
    if (normalized) {
      const prev = readUserFromStorage();
      const changed =
        !prev ||
        prev.id !== normalized.id ||
        prev.is_admin !== normalized.is_admin ||
        prev.is_moderator !== normalized.is_moderator ||
        (prev.avatar_url || "") !== (normalized.avatar_url || "") ||
        (prev.display_name || "") !== (normalized.display_name || "");
      if (changed) {
        localStorage.setItem("user", JSON.stringify(normalized));
        setUser(normalized);
      }
      return normalized;
    }
    return null;
  };

  const updateUser = (patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      localStorage.setItem("user", JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshSession, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};