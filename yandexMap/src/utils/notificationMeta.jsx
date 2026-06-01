import React from "react";
import {
  IconAlertCircle,
  IconBell,
  IconCheck,
  IconMessageSquare,
  IconPin,
  IconSettings,
  IconStar,
  IconThumbsUp,
  IconX,
} from "../components/Icons.jsx";

/** SVG-иконка по типу уведомления. */
export function NotifIcon({ kind, size = 20, className = "" }) {
  const k = (kind || "").toLowerCase();
  let Icon = IconBell;
  if (k.startsWith("marker_approved") || k === "marker_approved") Icon = IconCheck;
  else if (k.startsWith("marker_rejected")) Icon = IconX;
  else if (k.startsWith("marker_resolved") || k.startsWith("geo_resolved")) Icon = IconStar;
  else if (k.startsWith("marker_submitted")) Icon = IconMessageSquare;
  else if (k.startsWith("marker_in_progress")) Icon = IconSettings;
  else if (k.startsWith("geo_new")) Icon = IconPin;
  else if (k.startsWith("comment")) Icon = IconMessageSquare;
  else if (k.startsWith("abuse")) Icon = IconAlertCircle;
  else if (k.startsWith("support") || k.includes("like")) Icon = IconThumbsUp;

  return <Icon size={size} className={className} />;
}

export function groupNotificationsByDay(items) {
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  const groups = { today: [], yesterday: [], earlier: [] };
  for (const n of items) {
    const d = new Date(n.created_at);
    if (Number.isNaN(d.getTime())) {
      groups.earlier.push(n);
      continue;
    }
    if (d >= startToday) groups.today.push(n);
    else if (d >= startYesterday) groups.yesterday.push(n);
    else groups.earlier.push(n);
  }
  return groups;
}
