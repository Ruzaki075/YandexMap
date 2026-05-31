export function notifIcon(kind) {
  const k = (kind || "").toLowerCase();
  if (k.startsWith("marker_approved") || k === "marker_approved") return "✓";
  if (k.startsWith("marker_rejected")) return "✕";
  if (k.startsWith("marker_resolved") || k.startsWith("geo_resolved")) return "★";
  if (k.startsWith("marker_submitted")) return "📤";
  if (k.startsWith("marker_in_progress")) return "⚙";
  if (k.startsWith("geo_new")) return "📍";
  if (k.startsWith("comment")) return "💬";
  if (k.startsWith("abuse")) return "⚠";
  return "🔔";
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
