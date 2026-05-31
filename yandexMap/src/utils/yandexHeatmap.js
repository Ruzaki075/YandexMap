const HEATMAP_SCRIPT =
  "https://yastatic.net/s3/mapsapi-jslibs/heatmap/0.0.1/heatmap.min.js";

let heatmapScriptPromise = null;

/**
 * Скрипт heatmap.min.js при загрузке читает window.ymaps и регистрирует модуль `Heatmap`.
 * Без этого объекта (или если скрипт выполнился раньше API) — `module Heatmap is not defined`.
 */
function aliasYmapsGlobal(ymaps) {
  if (typeof window !== "undefined" && ymaps) {
    window.ymaps = ymaps;
  }
}

function waitForGlobalYmaps(timeoutMs = 20000, stepMs = 40) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = () => {
      if (typeof window !== "undefined" && window.ymaps) {
        window.ymaps.ready(() => resolve(window.ymaps));
        return;
      }
      if (Date.now() - t0 >= timeoutMs) {
        reject(new Error("Карта ещё не загружена"));
        return;
      }
      setTimeout(tick, stepMs);
    };
    tick();
  });
}

function heatmapScriptEl() {
  return document.querySelector(`script[src="${HEATMAP_SCRIPT}"]`);
}

function removeHeatmapScript() {
  const el = heatmapScriptEl();
  if (el) el.remove();
  heatmapScriptPromise = null;
}

function injectHeatmapScript() {
  if (!heatmapScriptPromise) {
    heatmapScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = HEATMAP_SCRIPT;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        heatmapScriptPromise = null;
        reject(new Error("Не удалось загрузить модуль теплокарты"));
      };
      document.head.appendChild(script);
    });
  }
  return heatmapScriptPromise;
}

/**
 * Запрос класса Heatmap: поддержка .done() (API 2.1) и колбэка из документации.
 */
function requireHeatmapClass(ymaps) {
  return new Promise((resolve, reject) => {
    const req = ymaps.modules.require(["Heatmap"]);
    if (req && typeof req.done === "function") {
      req.done(
        (first) => {
          const Heatmap = Array.isArray(first) ? first[0] : first;
          resolve(Heatmap);
        },
        (err) => reject(err)
      );
      return;
    }
    ymaps.modules.require(
      ["Heatmap"],
      (Heatmap) => resolve(Heatmap),
      (err) => reject(err)
    );
  });
}

/**
 * Подключение addon после window.ymaps; при «module is not defined» — сброс скрипта и повтор.
 */
async function ensureHeatmapClass(ymaps) {
  let api = ymaps;
  if (!api) {
    api = await waitForGlobalYmaps();
  }
  aliasYmapsGlobal(api);
  await new Promise((r) => api.ready(r));

  async function loadScriptIfNeeded() {
    if (!heatmapScriptEl()) {
      await injectHeatmapScript();
      await new Promise((r) => api.ready(r));
    } else if (heatmapScriptPromise) {
      await heatmapScriptPromise;
      await new Promise((r) => api.ready(r));
    }
  }

  await loadScriptIfNeeded();

  try {
    return await requireHeatmapClass(api);
  } catch (e) {
    const msg = e?.message || String(e);
    if (/not defined|Heatmap/i.test(msg) && heatmapScriptEl()) {
      removeHeatmapScript();
      aliasYmapsGlobal(api);
      await injectHeatmapScript();
      await new Promise((r) => api.ready(r));
      return requireHeatmapClass(api);
    }
    throw e;
  }
}

export function getYandexHeatmapClass(ymaps) {
  return ensureHeatmapClass(ymaps);
}

export function createHeatmapLayer(map, points, ymaps) {
  return ensureHeatmapClass(ymaps).then((Heatmap) => {
    const data =
      points?.map((pt) => [
        Number(pt.lat),
        Number(pt.lng),
        Number(pt.weight) || 1,
      ]) || [];
    const layer = new Heatmap(data, {
      radius: 22,
      dissipating: true,
      opacity: 0.9,
      intensityOfMidpoint: 0.35,
      gradient: {
        0.1: "rgba(0, 0, 255, 0.5)",
        0.4: "rgba(0, 255, 0, 0.65)",
        0.65: "rgba(255, 255, 0, 0.8)",
        0.85: "rgba(255, 128, 0, 0.9)",
        1.0: "rgba(255, 0, 0, 1)",
      },
    });
    layer.setMap(map);
    return layer;
  });
}
