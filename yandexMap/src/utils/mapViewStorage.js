const KEY = "yandexmap_view_v1";

/** Оренбург — центр карты по умолчанию (если нет сохранённого вида). */
export const DEFAULT_MAP_VIEW = {
  center: [51.7727, 55.0988],
  zoom: 12,
};

export function loadMapView() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (
      Array.isArray(v?.center) &&
      v.center.length === 2 &&
      typeof v.zoom === "number"
    ) {
      return { center: v.center, zoom: v.zoom };
    }
  } catch {
    /* */
  }
  return null;
}

export function saveMapView(center, zoom) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ center, zoom, savedAt: Date.now() })
    );
  } catch {
    /* */
  }
}
