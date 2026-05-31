import { MARKER_PRESET_OPTIONS } from "./markerColors.js";

/** Справочник preset → hex для превью (Яндекс.Карты используют preset, не hex в API). */
export const PRESET_HEX = {
  "islands#redIcon": "#e53935",
  "islands#blueIcon": "#1e88e5",
  "islands#greenIcon": "#43a047",
  "islands#orangeIcon": "#fb8c00",
  "islands#violetIcon": "#8e24aa",
  "islands#darkBlueIcon": "#1565c0",
  "islands#pinkIcon": "#d81b60",
  "islands#yellowIcon": "#fdd835",
  "islands#brownIcon": "#6d4c41",
  "islands#oliveIcon": "#827717",
  "islands#nightIcon": "#37474f",
  "islands#grayIcon": "#9e9e9e",
};

export function presetHex(preset) {
  return PRESET_HEX[preset] || "#9e9e9e";
}

function luminance(hex) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return 0.5;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const f = (c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Предупреждения при выборе цвета (контраст, дубликаты). */
export function validateColorChoice(preset, others = []) {
  const warnings = [];
  const hex = presetHex(preset);
  if (luminance(hex) > 0.82) {
    warnings.push("Светлый цвет: метка может плохо читаться на светлой подложке карты.");
  }
  if (luminance(hex) < 0.12) {
    warnings.push("Очень тёмный цвет: метка может теряться на тёмной карте.");
  }
  const dup = others.filter((o) => o.marker_icon === preset);
  if (dup.length > 0) {
    warnings.push(
      `Этот цвет уже у: ${dup.map((d) => d.label_ru).join(", ")}. Рекомендуем разные цвета для направлений.`
    );
  }
  const similar = others.filter((o) => {
    if (o.marker_icon === preset) return false;
    const d = colorDistance(hex, presetHex(o.marker_icon));
    return d < 36;
  });
  if (similar.length > 0) {
    warnings.push(
      `Похож на цвет «${similar[0].label_ru}». Возможна путаница на карте.`
    );
  }
  return warnings;
}

function colorDistance(h1, h2) {
  const parse = (h) => {
    const x = h.replace("#", "");
    return [
      parseInt(x.slice(0, 2), 16),
      parseInt(x.slice(2, 4), 16),
      parseInt(x.slice(4, 6), 16),
    ];
  };
  const [r1, g1, b1] = parse(h1);
  const [r2, g2, b2] = parse(h2);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

export function presetOptionsWithHex() {
  return MARKER_PRESET_OPTIONS.map((o) => ({
    ...o,
    hex: presetHex(o.value),
  }));
}
