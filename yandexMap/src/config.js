const raw =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL) ||
  "http://localhost:8080";

export const API_ORIGIN = String(raw).replace(/\/$/, "");
export const API_URL = `${API_ORIGIN}/api`;
