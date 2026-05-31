export const MARKER_PRESET_OPTIONS = [
  { value: "islands#redIcon", label: "Красный" },
  { value: "islands#blueIcon", label: "Синий" },
  { value: "islands#greenIcon", label: "Зелёный" },
  { value: "islands#orangeIcon", label: "Оранжевый" },
  { value: "islands#violetIcon", label: "Фиолетовый" },
  { value: "islands#darkBlueIcon", label: "Тёмно-синий" },
  { value: "islands#pinkIcon", label: "Розовый" },
  { value: "islands#yellowIcon", label: "Жёлтый" },
  { value: "islands#brownIcon", label: "Коричневый" },
  { value: "islands#oliveIcon", label: "Оливковый" },
  { value: "islands#nightIcon", label: "Тёмный" },
  { value: "islands#grayIcon", label: "Серый" },
];

const FALLBACK_PRESETS = MARKER_PRESET_OPTIONS.map((o) => o.value);

export const FALLBACK_MARKER_PRESET = "islands#grayIcon";

/** Цвет метки по классификации; решённые — серые. */
export function getMarkerPreset(domainKey, taxonomy, status) {
  const st = (status || "").toLowerCase();
  if (st === "resolved") return "islands#grayIcon";
  if (!domainKey) return FALLBACK_MARKER_PRESET;
  const d = taxonomy?.domains?.find((x) => x.key === domainKey);
  if (d?.marker_icon) return d.marker_icon;
  let h = 0;
  for (let i = 0; i < domainKey.length; i += 1) {
    h = (h * 31 + domainKey.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_PRESETS[h % FALLBACK_PRESETS.length];
}

export function markerPresetLabel(preset) {
  return MARKER_PRESET_OPTIONS.find((o) => o.value === preset)?.label || preset;
}
