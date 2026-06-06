import { useCallback, useContext, useEffect, useState } from "react";
import { AuthContext } from "../components/Auth/AuthContext.jsx";
import { getNotificationsUnreadCount } from "../services/api.js";

export function useUnreadNotifications(pollMs = 25000) {
  const { user } = useContext(AuthContext);
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setCount(0);
      return;
    }
    try {
      const n = await getNotificationsUnreadCount();
      setCount(typeof n === "number" ? n : 0);
    } catch {
      /* ignore */
    }
  }, [user]);

  useEffect(() => {
    refresh();
    if (!user) return undefined;
    const t = setInterval(refresh, pollMs);
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onEvent = () => refresh();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("yandexmap:notifications", onEvent);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("yandexmap:notifications", onEvent);
    };
  }, [user, refresh, pollMs]);

  return { unreadCount: count, refreshUnread: refresh };
}
