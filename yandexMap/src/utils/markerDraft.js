const KEY = "yandexmap_marker_draft";

export function saveMarkerDraft(draft) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    /* */
  }
}

export function loadMarkerDraft() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (Date.now() - (d.savedAt || 0) > 7 * 24 * 3600 * 1000) {
      clearMarkerDraft();
      return null;
    }
    return d;
  } catch {
    return null;
  }
}

export function clearMarkerDraft() {
  localStorage.removeItem(KEY);
}
