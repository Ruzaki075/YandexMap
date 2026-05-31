import { API_ORIGIN } from "../config.js";

/** Полный URL аватара для <img src>. */
export function resolveAvatarUrl(avatarUrl) {
  if (!avatarUrl || typeof avatarUrl !== "string") return null;
  const u = avatarUrl.trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return `${API_ORIGIN}${u.startsWith("/") ? u : `/${u}`}`;
}
