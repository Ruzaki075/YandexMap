/** Проверка exp без секрета (payload JWT в base64url). */
export function isTokenExpired(token) {
  if (!token || typeof token !== "string") return true;
  try {
    const part = token.split(".")[1];
    if (!part) return true;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));
    if (!payload.exp) return false;
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export function clearStoredAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
