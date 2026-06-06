/** Пресеты для админки классификации (ручной выбор иконки). */
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

/** Цвет направления для легенды карты. */
export const CATEGORY_COLORS = {
  roads: "#1565C0",
  transit: "#6A1B9A",
  pedestrian: "#2E7D32",
  utilities: "#E65100",
  social: "#AD1457",
};

/** Обычные метки-булавки (islands#*Icon), цвет по направлению. */
const DOMAIN_PIN = {
  roads: "islands#darkBlueIcon",
  transit: "islands#violetIcon",
  pedestrian: "islands#greenIcon",
  utilities: "islands#orangeIcon",
  social: "islands#pinkIcon",
};

/** На модерации — та же булавка с точкой (DotIcon). */
const DOMAIN_PIN_PENDING = {
  roads: "islands#darkBlueDotIcon",
  transit: "islands#violetDotIcon",
  pedestrian: "islands#greenDotIcon",
  utilities: "islands#orangeDotIcon",
  social: "islands#pinkDotIcon",
};

export function getCategoryColor(domainKey, taxonomy) {
  const key = domainKey || "";
  if (CATEGORY_COLORS[key]) return CATEGORY_COLORS[key];
  const d = taxonomy?.domains?.find((x) => x.key === key);
  if (d?.marker_icon) {
    const preset = String(d.marker_icon);
    if (preset.includes("blue")) return CATEGORY_COLORS.roads;
    if (preset.includes("violet")) return CATEGORY_COLORS.transit;
    if (preset.includes("green")) return CATEGORY_COLORS.pedestrian;
    if (preset.includes("orange")) return CATEGORY_COLORS.utilities;
    if (preset.includes("pink")) return CATEGORY_COLORS.social;
  }
  return "#CC0000";
}

let cachedClusterLayout = null;

/** Опции Clusterer: красные круги с числом (бренд #CC0000). */
export function buildClustererOptions(ymapsApi) {
  const base = {
    groupByCoordinates: false,
    clusterDisableClickZoom: false,
    clusterHideIconOnBalloonOpen: false,
    geoObjectHideIconOnBalloonOpen: false,
    gridSize: 64,
  };

  if (!ymapsApi?.templateLayoutFactory) {
    return {
      ...base,
      preset: "islands#invertedDarkBlueClusterIcons",
    };
  }

  if (!cachedClusterLayout) {
    cachedClusterLayout = ymapsApi.templateLayoutFactory.createClass(
      '<div style="' +
        "width:44px;height:44px;" +
        "background:#CC0000;" +
        "border:2px solid rgba(255,255,255,0.25);" +
        "border-radius:50%;" +
        "box-shadow:0 2px 12px rgba(204,0,0,0.5);" +
        "display:flex;align-items:center;justify-content:center;" +
        "color:#fff;font-size:14px;font-weight:700;" +
        'font-family:Inter,sans-serif;">' +
        "{{ properties.geoObjects.length }}</div>"
    );
  }

  return {
    ...base,
    clusterIcons: [
      {
        href: "none",
        size: [44, 44],
        offset: [-22, -22],
      },
    ],
    clusterIconContentLayout: cachedClusterLayout,
  };
}

/** Пресет метки-булавки: цвет по направлению; pending — DotIcon, resolved — серая. */
export function getMarkerPreset(domainKey, taxonomy, status) {
  const st = (status || "").toLowerCase();
  if (st === "resolved") return "islands#grayIcon";
  if (st === "rejected") return "islands#grayIcon";
  const key = domainKey || "";
  if (st === "pending") {
    return DOMAIN_PIN_PENDING[key] || "islands#grayDotIcon";
  }
  if (DOMAIN_PIN[key]) return DOMAIN_PIN[key];
  if (!key) return "islands#grayIcon";
  const d = taxonomy?.domains?.find((x) => x.key === key);
  if (d?.marker_icon) return d.marker_icon;
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_PRESETS[h % FALLBACK_PRESETS.length];
}

/** Содержимое иконки (галочка для решённых). */
export function getMarkerIconContent(status) {
  if ((status || "").toLowerCase() === "resolved") return "✓";
  return "";
}

export function markerPresetLabel(preset) {
  return MARKER_PRESET_OPTIONS.find((o) => o.value === preset)?.label || preset;
}
