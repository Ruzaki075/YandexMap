import { formatDueLine, STATUS_LABELS } from "../../utils/slaLabels.js";

export function normStatus(m) {
  return m?.status || "pending";
}

export function formatMarkerDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ru-RU");
}

/** «5 мин назад» или полная дата, если старше суток */
export function formatRelativeDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return "—";
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 60) return "только что";
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    return `${m} мин назад`;
  }
  if (sec < 86400) {
    const h = Math.floor(sec / 3600);
    return `${h} ч назад`;
  }
  if (sec < 604800) {
    const days = Math.floor(sec / 86400);
    return `${days} дн назад`;
  }
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function pluralReports(n) {
  const x = Math.abs(Number(n) || 0);
  const mod10 = x % 10;
  const mod100 = x % 100;
  if (mod10 === 1 && mod100 !== 11) return `${x} жалоба`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${x} жалобы`;
  }
  return `${x} жалоб`;
}

export function formatReviewShort(m) {
  const c = m.review_count ?? 0;
  if (!c) return null;
  const avg = m.review_avg != null ? Number(m.review_avg).toFixed(1) : "—";
  return `${avg} ★ (${c})`;
}

const YMAPS_STATIC_KEY = "e99fcd77-5ec6-4928-85ff-47ddb2f50012";

export function staticMapUrl(lat, lng) {
  if (lat == null || lng == null) return "";
  return `https://static-maps.yandex.ru/1.x/?apikey=${YMAPS_STATIC_KEY}&ll=${lng},${lat}&z=16&l=map&size=640,320&pt=${lng},${lat},pm2rdm`;
}

export function slaCountdown(marker) {
  const st = normStatus(marker);
  let deadline = null;
  if (st === "pending" && marker.response_due_at) {
    deadline = new Date(marker.response_due_at);
  } else if (
    (st === "approved" || st === "in_progress") &&
    marker.resolution_due_at
  ) {
    deadline = new Date(marker.resolution_due_at);
  }
  if (!deadline || Number.isNaN(deadline.getTime())) {
    return { text: formatDueLine(marker) || "—", overdue: !!marker.is_overdue };
  }
  const ms = deadline.getTime() - Date.now();
  const overdue = ms < 0;
  const abs = Math.abs(ms);
  const d = Math.floor(abs / 86400000);
  const h = Math.floor((abs % 86400000) / 3600000);
  const min = Math.floor((abs % 3600000) / 60000);
  const human =
    d > 0 ? `${d}д ${h}ч` : h > 0 ? `${h}ч ${min}м` : `${min}м`;
  return {
    text: overdue ? `−${human}` : human,
    overdue: overdue || marker.is_overdue,
  };
}

export { STATUS_LABELS };
