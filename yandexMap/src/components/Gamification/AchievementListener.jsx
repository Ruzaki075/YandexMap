import React, { useContext } from "react";
import { AuthContext } from "../Auth/AuthContext.jsx";
import { useRealtime } from "../../hooks/useRealtime.js";
import { showToast } from "../ToastHost.jsx";

/** Toast при новом достижении через WebSocket. */
export default function AchievementListener() {
  const { user } = useContext(AuthContext);

  useRealtime({
    enabled: !!user,
    onAchievement: (payload) => {
      const title = payload?.title || "Новое достижение!";
      showToast(title, "success");
    },
  });

  return null;
}
