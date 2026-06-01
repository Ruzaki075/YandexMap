/** UI-константы категорий для сайдбара и карточек списка (иконки — SVG в Icons.jsx). */
export const CATEGORY_UI = {
  roads: { bg: "#1565C0", short: "Дороги" },
  transit: { bg: "#6A1B9A", short: "Транспорт" },
  pedestrian: { bg: "#2E7D32", short: "Пешеходы" },
  utilities: { bg: "#E65100", short: "ЖКХ" },
  social: { bg: "#AD1457", short: "Соцсфера" },
};

const AVATAR_COLORS = [
  "#1565C0",
  "#6A1B9A",
  "#C62828",
  "#2E7D32",
  "#E65100",
  "#AD1457",
];

/** Стабильный цвет аватара по id пользователя. */
export function avatarColor(userId) {
  const id = Number(userId) || 0;
  return AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length];
}

export function userInitials(marker) {
  return authorInitials(marker);
}

/** Инициалы для аватара (Иванов Иван → ИИ). */
export function authorInitials(marker) {
  const name = String(marker?.user_email || "").trim();
  if (!name) return "Г";
  if (name.includes("@")) {
    const local = name.split("@")[0];
    const parts = local.split(/[._-]+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return local.slice(0, 2).toUpperCase();
  }
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/** Отображаемое имя автора. */
export function authorName(marker) {
  const raw = String(marker?.user_email || "").trim();
  if (!raw) return "Участник";
  if (raw.includes("@")) {
    const local = raw.split("@")[0].replace(/[._-]+/g, " ").trim();
    if (!local) return "Участник";
    return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return raw;
}

/** Адрес: первая строка — улица/дом, вторая — район/округ. */
export function splitMarkerAddress(full) {
  const raw = String(full || "").trim();
  if (!raw) {
    return { line1: "Адрес уточняется…", line2: "" };
  }
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return { line1: raw, line2: "" };
  }
  if (parts.length === 2) {
    return { line1: parts[0], line2: parts[1] };
  }
  return {
    line1: parts.slice(0, 2).join(", "),
    line2: parts.slice(2).join(", "),
  };
}

export function formatPublishedLine(marker) {
  const d = marker?.created_at
    ? new Date(marker.created_at).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  return `Опубликовано ${d}, №${marker?.id ?? "—"}`;
}

export function markerAddressLine(marker, fallback = "Адрес не указан") {
  if (marker?.address_text?.trim()) return marker.address_text.trim();
  const t = marker?.text?.trim();
  if (t) return t.length > 48 ? `${t.slice(0, 48)}…` : t;
  return fallback;
}

export function formatMarkerDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Склонение «лайк / лайка / лайков». */
export function likeWord(n) {
  const abs = Math.abs(Number(n) || 0) % 100;
  const mod = abs % 10;
  if (mod === 1 && abs !== 11) return "лайк";
  if (mod >= 2 && mod <= 4 && (abs < 10 || abs >= 20)) return "лайка";
  return "лайков";
}

export function markerSupportCount(marker) {
  return Number(marker?.support_count) || 0;
}

/** Сначала с большим числом лайков, затем по дате создания. */
export function compareMarkersByLikesDesc(a, b) {
  const diff = markerSupportCount(b) - markerSupportCount(a);
  if (diff !== 0) return diff;
  const tb = new Date(b.created_at || 0).getTime();
  const ta = new Date(a.created_at || 0).getTime();
  return tb - ta;
}
