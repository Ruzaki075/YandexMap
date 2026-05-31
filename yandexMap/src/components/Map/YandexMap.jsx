import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { useLocation, useHistory, Link } from "react-router-dom";
import {
  YMaps,
  Map,
  Placemark,
  Clusterer,
  useYMaps,
} from "@pbe/react-yandex-maps";
import MapHeader from "./MapHeader.jsx";
import { useTaxonomy } from "../../hooks/useTaxonomy.js";
import { AuthContext } from "../Auth/AuthContext.jsx";
import { API_ORIGIN } from "../../config.js";
import {
  classifyProblemText,
  classifyProblemImage,
  getMarkers,
  getMyMarkers,
  getMapStats,
  deleteMarker,
  createMarker,
  uploadImage as uploadImageApi,
  getMarkerReviewSummary,
  getMyMarkerReview,
  listMarkerReviews,
  postMarkerReview,
  getMarkerSupports,
  postMarkerSupport,
  deleteMarkerSupport,
  getHeatmapPoints,
  searchMarkers,
} from "../../services/api.js";
import {
  saveMarkerDraft,
  loadMarkerDraft,
  clearMarkerDraft,
} from "../../utils/markerDraft.js";
import {
  MarkerModalToolbar,
  MarkerTimelineFull,
  MarkerBeforeAfter,
} from "./MarkerModalExtras.jsx";
import "./MarkerModalExtras.css";
import { readImageGps } from "../../utils/exifGps.js";
import { reverseGeocode } from "../../utils/reverseGeocode.js";
import { createHeatmapLayer } from "../../utils/yandexHeatmap.js";
import { formatDueLine, STATUS_LABELS } from "../../utils/slaLabels.js";
import {
  findCategoryLabels,
  formatCategoryLine,
} from "../../utils/issueLabels.js";
import { showToast } from "../ToastHost.jsx";
import { useRealtime } from "../../hooks/useRealtime.js";
import { loadMapView, saveMapView } from "../../utils/mapViewStorage.js";
import { getMarkerPreset, markerPresetLabel } from "../../utils/markerColors.js";
import OnboardingModal, {
  isOnboardingDone,
} from "../Onboarding/OnboardingModal.jsx";
import "./YandexMap.css";

const TEXT_CLASSIFY_MIN_LEN = 8;

function escapeHtml(str) {
  if (str == null || str === "") return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Балун Яндекс.Карт — только инлайн-стили; текст экранируем, фото сверху без подписи поверх снимка. */
function buildMarkerBalloonHtml(p, taxonomy) {
  const typeLabels = findCategoryLabels(taxonomy, p.domain_key);
  const chunks = [
    '<div style="box-sizing:border-box;font-family:system-ui,-apple-system,\'Segoe UI\',Roboto,sans-serif;max-width:300px;padding:2px 4px 6px;color:#111827;">',
  ];

  const st = p.status || "pending";
  if (st === "pending") {
    chunks.push(
      '<div style="font-size:11px;font-weight:600;color:#c2410c;margin:0 0 8px;">На модерации</div>'
    );
  } else if (st === "approved") {
    chunks.push(
      '<div style="font-size:11px;font-weight:600;color:#047857;margin:0 0 8px;">Активное обращение</div>'
    );
  } else if (st === "in_progress") {
    chunks.push(
      '<div style="font-size:11px;font-weight:600;color:#b45309;margin:0 0 8px;">В работе</div>'
    );
  } else if (st === "resolved") {
    chunks.push(
      '<div style="font-size:11px;font-weight:600;color:#1d4ed8;margin:0 0 8px;">Решено</div>'
    );
  }
  const dueLine = formatDueLine(p);
  if (dueLine) {
    const col = p.is_overdue ? "#b91c1c" : "#6b7280";
    chunks.push(
      `<div style="font-size:11px;font-weight:600;color:${col};margin:0 0 8px;">${escapeHtml(dueLine)}</div>`
    );
  }

  if (p.image_url) {
    const src = `${API_ORIGIN}${p.image_url}`;
    chunks.push(
      '<div style="border-radius:12px;overflow:hidden;background:#0c0c0c;margin:0 0 12px;display:flex;align-items:center;justify-content:center;max-height:240px;">',
      `<img src="${escapeHtml(src)}" alt="" style="display:block;max-width:100%;max-height:240px;width:auto;height:auto;object-fit:contain;margin:0 auto;" />`,
      "</div>"
    );
  }

  if (typeLabels) {
    const line = escapeHtml(formatCategoryLine(typeLabels));
    const aiHint =
      p.ai_confidence != null
        ? `<span style="margin-left:6px;font-size:11px;color:#6b7280;font-weight:500;">ИИ ${Number(
            p.ai_confidence
          ).toFixed(2)}</span>`
        : "";
    chunks.push(
      `<div style="margin-bottom:10px;"><span style="display:inline-block;padding:5px 12px;border-radius:999px;background:linear-gradient(135deg,#fef2f2,#fff1f2);border:1px solid #fecaca;color:#b91c1c;font-size:12px;font-weight:600;">${line}</span>${aiHint}</div>`
    );
  }

  const sc = Number(p.support_count) || 0;
  if (sc > 0) {
    chunks.push(
      `<div style="font-size:12px;font-weight:600;color:#7c3aed;margin-bottom:8px;">Подтвердили проблему: ${sc}</div>`
    );
  }

  const rc = Number(p.review_count) || 0;
  if (rc > 0) {
    const avg =
      p.review_avg != null && !Number.isNaN(Number(p.review_avg))
        ? Number(p.review_avg).toFixed(1)
        : "—";
    chunks.push(
      `<div style="font-size:12px;font-weight:600;color:#b45309;margin-bottom:8px;">Оценка людей: ${avg} ★ (${rc})</div>`
    );
  }

  chunks.push(
    `<div style="font-size:14px;line-height:1.55;color:#374151;word-break:break-word;overflow-wrap:anywhere;white-space:pre-wrap;margin-bottom:12px;">${escapeHtml(
      p.text || "—"
    )}</div>`,
    '<div style="font-size:12px;color:#9ca3af;padding-top:10px;border-top:1px solid #e5e7eb;line-height:1.45;">',
    escapeHtml(p.user_email || "—"),
    " · ",
    escapeHtml(
      new Date(p.created_at).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    ),
    "</div></div>"
  );

  return chunks.join("");
}

function authHeadersJson() {
  const token = localStorage.getItem("token");
  const h = { "Content-Type": "application/json" };
  if (token && token !== "undefined" && token !== "null") {
    h.Authorization = `Bearer ${token}`;
  }
  return h;
}

function authHeadersMultipart() {
  const token = localStorage.getItem("token");
  const h = {};
  if (token && token !== "undefined" && token !== "null") {
    h.Authorization = `Bearer ${token}`;
  }
  return h;
}

/**
 * Сохраняет экземпляр API из контекста YMaps. Без этого heatmap ждёт window.ymaps,
 * а @pbe/react-yandex-maps часто держит API только внутри провайдера — таймаут «Карта ещё не загружена».
 */
/** Убирает встроенный поиск «Адрес или объект» и прочие контролы API. */
function stripYmapsBuiltInControls(map) {
  if (!map?.controls) return;
  const ids = [
    "searchControl",
    "geolocationControl",
    "routeButtonControl",
    "trafficControl",
    "typeSelector",
    "fullscreenControl",
    "zoomControl",
    "rulerControl",
  ];
  for (const id of ids) {
    try {
      map.controls.remove(id);
    } catch {
      /* */
    }
  }
  try {
    if (typeof map.controls.each === "function") {
      const leftover = [];
      map.controls.each((c) => leftover.push(c));
      for (const c of leftover) {
        try {
          map.controls.remove(c);
        } catch {
          /* */
        }
      }
    }
  } catch {
    /* */
  }
}

function YmapsApiBridge({ onReady }) {
  const ymaps = useYMaps([]);
  useEffect(() => {
    if (ymaps) onReady(ymaps);
  }, [ymaps, onReady]);
  return null;
}

const YandexMap = () => {
  const { user } = useContext(AuthContext);
  const { taxonomy } = useTaxonomy();
  const location = useLocation();
  const history = useHistory();
  const [placemarks, setPlacemarks] = useState([]);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [newPointText, setNewPointText] = useState("");
  const [newPointImage, setNewPointImage] = useState(null);
  const [newPointImageFile, setNewPointImageFile] = useState(null);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [problemDomainKey, setProblemDomainKey] = useState("");
  const [aiConfidence, setAiConfidence] = useState(null);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [detectionLine, setDetectionLine] = useState(null);
  const [detectionConfidence, setDetectionConfidence] = useState(null);
  const [detectionVia, setDetectionVia] = useState(null);
  const [detectionBusy, setDetectionBusy] = useState(false);
  const [detectionHint, setDetectionHint] = useState(null);

  const [reviewBlock, setReviewBlock] = useState({
    summary: null,
    mine: null,
    list: [],
    loading: false,
    err: "",
  });
  const [reviewRating, setReviewRating] = useState(4);
  const [reviewComment, setReviewComment] = useState("");
  const [mapLayer, setMapLayer] = useState("active");
  const [mapDomainFilter, setMapDomainFilter] = useState("");
  const [mapSearch, setMapSearch] = useState("");
  const [mapStats, setMapStats] = useState(null);
  const [deletingMarker, setDeletingMarker] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [serverSearchMarkers, setServerSearchMarkers] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [supportBlock, setSupportBlock] = useState({
    count: 0,
    iSupported: false,
    loading: false,
    saving: false,
    err: "",
  });
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [mapFiltersOpen, setMapFiltersOpen] = useState(false);
  const [dockExpanded, setDockExpanded] = useState(
    () => typeof window !== "undefined" && window.innerWidth > 768
  );
  const [mapReady, setMapReady] = useState(false);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  /** Тот же объект ymaps, что использует карта (не обязательно равен window.ymaps). */
  const [ymapsApi, setYmapsApi] = useState(null);
  const [mapLegendOpen, setMapLegendOpen] = useState(false);
  const [mapMineOnly, setMapMineOnly] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [pickAddress, setPickAddress] = useState("");
  const [pickAddressLoading, setPickAddressLoading] = useState(false);
  const [markerAddress, setMarkerAddress] = useState("");
  const [nearbyPrompt, setNearbyPrompt] = useState(null);
  const [imageGps, setImageGps] = useState(null);
  const mapInstanceRef = useRef(null);
  const heatmapRef = useRef(null);
  const skipAutoSelectsRef = useRef(false);
  const suppressTextClassifyRef = useRef(false);
  const textClassifySeq = useRef(0);
  const imageClassifySeq = useRef(0);


  const mapDefault = loadMapView() || {
    center: [55.751244, 37.618423],
    zoom: 11,
  };

  useEffect(() => {
    loadMarkers();
  }, [mapLayer, user?.id]);

  useEffect(() => {
    if (user && !isOnboardingDone()) setShowOnboarding(true);
  }, [user]);

  useEffect(() => {
    getMapStats()
      .then(setMapStats)
      .catch(() => setMapStats(null));
  }, [placemarks.length, mapLayer]);

  useEffect(() => {
    if (!showAddPanel || !selectedCoords?.length) {
      setPickAddress("");
      setPickAddressLoading(false);
      return;
    }
    let cancelled = false;
    setPickAddressLoading(true);
    reverseGeocode(selectedCoords).then((addr) => {
      if (!cancelled) {
        setPickAddress(addr);
        setPickAddressLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [showAddPanel, selectedCoords]);

  useEffect(() => {
    if (!selectedMarker?.latitude || !selectedMarker?.longitude) {
      setMarkerAddress("");
      return;
    }
    let cancelled = false;
    reverseGeocode([selectedMarker.latitude, selectedMarker.longitude]).then(
      (addr) => {
        if (!cancelled) setMarkerAddress(addr);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [selectedMarker?.id, selectedMarker?.latitude, selectedMarker?.longitude]);

  const hasActiveFilters = Boolean(
    mapMineOnly || mapDomainFilter || mapSearch.trim().length > 0
  );

  const filteredPlacemarks = useMemo(() => {
    let list =
      serverSearchMarkers != null && mapSearch.trim().length >= 2
        ? serverSearchMarkers
        : placemarks;
    if (mapMineOnly && user?.id) {
      list = list.filter((m) => m.user_id === user.id);
    }
    if (mapDomainFilter) {
      list = list.filter((m) => m.domain_key === mapDomainFilter);
    }
    const q = mapSearch.trim().toLowerCase();
    if (q && serverSearchMarkers == null) {
      list = list.filter(
        (m) =>
          (m.text || "").toLowerCase().includes(q) ||
          (m.user_email || "").toLowerCase().includes(q) ||
          (m.address_text || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [
    placemarks,
    serverSearchMarkers,
    mapDomainFilter,
    mapSearch,
    mapMineOnly,
    user?.id,
  ]);

  useEffect(() => {
    const q = mapSearch.trim();
    if (q.length < 2) {
      setServerSearchMarkers(null);
      setSearchLoading(false);
      return undefined;
    }
    setSearchLoading(true);
    const t = setTimeout(() => {
      searchMarkers(q, 80)
        .then((d) => setServerSearchMarkers(d.markers || []))
        .catch(() => setServerSearchMarkers([]))
        .finally(() => setSearchLoading(false));
    }, 400);
    return () => clearTimeout(t);
  }, [mapSearch]);

  useEffect(() => {
    const id = new URLSearchParams(location.search).get("marker");
    if (!id || !Array.isArray(placemarks) || placemarks.length === 0) return;
    const num = parseInt(id, 10);
    if (Number.isNaN(num)) return;
    const found = placemarks.find((p) => Number(p.id) === num);
    if (found) setSelectedMarker(found);
  }, [location.search, placemarks]);

  useEffect(() => {
    if (!selectedMarker?.id) return;
    let cancelled = false;
    (async () => {
      setReviewBlock((s) => ({ ...s, loading: true, err: "" }));
      try {
        const sum = await getMarkerReviewSummary(selectedMarker.id);
        const listData = await listMarkerReviews(selectedMarker.id, {
          limit: 8,
          offset: 0,
        });
        let mine = null;
        try {
          const m = await getMyMarkerReview(selectedMarker.id);
          mine = m?.review ?? null;
        } catch {
          mine = null;
        }
        if (cancelled) return;
        setReviewBlock({
          summary: sum,
          mine,
          list: listData.reviews || [],
          loading: false,
          err: "",
        });
        if (mine?.rating) {
          setReviewRating(mine.rating);
        } else {
          setReviewRating(4);
        }
        setReviewComment(mine?.comment || "");
      } catch (e) {
        if (!cancelled) {
          setReviewBlock((s) => ({
            ...s,
            loading: false,
            err: e.message || "Ошибка отзывов",
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedMarker?.id]);

  useEffect(() => {
    if (!selectedMarker?.id) return;
    let cancelled = false;
    (async () => {
      setSupportBlock((s) => ({ ...s, loading: true, err: "" }));
      try {
        const data = await getMarkerSupports(selectedMarker.id);
        if (!cancelled) {
          setSupportBlock({
            count: data.count ?? 0,
            iSupported: !!data.i_supported,
            loading: false,
            saving: false,
            err: "",
          });
        }
      } catch (e) {
        if (!cancelled) {
          setSupportBlock((s) => ({
            ...s,
            loading: false,
            err: e.message || "Ошибка",
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedMarker?.id]);

  useEffect(() => {
    const map = mapInstanceRef.current;

    if (heatmapRef.current) {
      heatmapRef.current.setMap(null);
      heatmapRef.current = null;
    }

    if (!showHeatmap) {
      setHeatmapLoading(false);
      return undefined;
    }

    if (!map || !mapReady || !ymapsApi) {
      setHeatmapLoading(true);
      return undefined;
    }

    let cancelled = false;
    setHeatmapLoading(true);

    (async () => {
      try {
        const layer =
          mapLayer === "resolved"
            ? "resolved"
            : mapLayer === "all"
              ? "all"
              : "active";
        const { points } = await getHeatmapPoints(layer);
        if (cancelled) return;

        if (!points?.length) {
          showToast("Нет обращений для теплокарты на этом слое", "error");
          setShowHeatmap(false);
          return;
        }

        const hm = await createHeatmapLayer(map, points, ymapsApi);
        if (cancelled) {
          hm.setMap(null);
          return;
        }
        heatmapRef.current = hm;
      } catch (e) {
        console.error("heatmap", e);
        showToast(
          e.message || "Не удалось включить теплокарту",
          "error"
        );
        setShowHeatmap(false);
      } finally {
        if (!cancelled) setHeatmapLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showHeatmap, mapLayer, placemarks.length, mapReady, ymapsApi]);

  const toggleSupport = async () => {
    if (!selectedMarker?.id || !user) return;
    if (user.id === selectedMarker.user_id) return;
    setSupportBlock((s) => ({ ...s, saving: true }));
    try {
      const res = supportBlock.iSupported
        ? await deleteMarkerSupport(selectedMarker.id)
        : await postMarkerSupport(selectedMarker.id);
      const cnt = res.count ?? supportBlock.count;
      setSupportBlock({
        count: cnt,
        iSupported: !supportBlock.iSupported,
        loading: false,
        saving: false,
        err: "",
      });
      setPlacemarks((prev) =>
        prev.map((p) =>
          p.id === selectedMarker.id ? { ...p, support_count: cnt } : p
        )
      );
      setSelectedMarker((m) =>
        m && m.id === selectedMarker.id ? { ...m, support_count: cnt } : m
      );
      showToast(
        supportBlock.iSupported
          ? "Поддержка снята"
          : "Спасибо — приоритет заявки вырос",
        "success"
      );
    } catch (e) {
      setSupportBlock((s) => ({ ...s, saving: false, err: e.message }));
      showToast(e.message || "Ошибка", "error");
    }
  };

  const applyClassifierBest = useCallback((data, viaLabel) => {
    const best = data.best;
    if (!best?.domain_key) {
      setDetectionLine(null);
      setDetectionConfidence(null);
      setDetectionVia(null);
      return;
    }
    const labels = { domain: best.domain_label_ru };
    setDetectionLine(formatCategoryLine(labels));
    setDetectionConfidence(
      typeof data.ai_confidence === "number" ? data.ai_confidence : null
    );
    setDetectionVia(viaLabel);
    if (!skipAutoSelectsRef.current) {
      setProblemDomainKey(best.domain_key);
      setAiConfidence(
        typeof data.ai_confidence === "number" ? data.ai_confidence : null
      );
    }
  }, []);

  /** Автоклассификация по описанию (после паузы в наборе). */
  useEffect(() => {
    if (!showAddPanel) return;
    if (suppressTextClassifyRef.current) return;
    const text = newPointText.trim();
    if (text.length < TEXT_CLASSIFY_MIN_LEN) {
      if (!newPointImageFile) {
        setDetectionHint(
          "Введите описание — направление подставится автоматически."
        );
      }
      return;
    }

    const seq = ++textClassifySeq.current;
    const timer = setTimeout(async () => {
      try {
        setDetectionBusy(true);
        setDetectionHint(null);
        const data = await classifyProblemText(text);
        if (seq !== textClassifySeq.current) return;
        applyClassifierBest(data, "по тексту описания");
      } catch (e) {
        if (seq !== textClassifySeq.current) return;
        console.error(e);
        setDetectionHint(
          "Не удалось связаться с классификатором (порт 5055). Описание всё равно можно сохранить."
        );
        setDetectionLine(null);
        setDetectionVia(null);
        setDetectionConfidence(null);
      } finally {
        if (seq === textClassifySeq.current) setDetectionBusy(false);
      }
    }, 550);

    return () => {
      clearTimeout(timer);
    };
  }, [newPointText, showAddPanel, newPointImageFile, applyClassifierBest]);

  /** Если описания мало, но есть фото — пробуем прочитать текст на снимке (не дублируем длинное описание). */
  useEffect(() => {
    if (!showAddPanel || !newPointImageFile) return;
    if (newPointText.trim().length >= TEXT_CLASSIFY_MIN_LEN) return;

    const seq = ++imageClassifySeq.current;
    const timer = setTimeout(async () => {
      try {
        setDetectionBusy(true);
        const data = await classifyProblemImage(newPointImageFile);
        if (seq !== imageClassifySeq.current) return;

        if (data.need_text && !data.best) {
          const extra =
            Array.isArray(data.hints) && data.hints.length
              ? ` ${data.hints.join(" ")}`
              : "";
          setDetectionHint(
            (data.message || "По фото тип не определён — допишите описание.") +
              extra
          );
          setDetectionLine(null);
          setDetectionVia(null);
          setDetectionConfidence(null);
          return;
        }

        if (data.best?.domain_key) {
          const best = data.best;
          const via =
            data.source === "image_visual" ||
            data.source === "image_visual_low" ||
            data.source === "image_visual_guess"
              ? "по содержимому фото (CLIP)"
              : data.source === "image_ocr"
                ? "по тексту на фото (OCR)"
                : "по фото";

          suppressTextClassifyRef.current = true;
          setTimeout(() => {
            suppressTextClassifyRef.current = false;
          }, 900);

          setNewPointText((prev) => {
            if (prev.trim().length >= TEXT_CLASSIFY_MIN_LEN) return prev;
            return formatCategoryLine({ domain: best.domain_label_ru });
          });

          const hintParts = [];
          if (data.extracted_text) {
            hintParts.push(
              `С фото прочитано: «${data.extracted_text.slice(0, 120)}${data.extracted_text.length > 120 ? "…" : ""}»`
            );
          }
          if (data.message) hintParts.push(data.message);
          setDetectionHint(hintParts.length ? hintParts.join(" ") : null);

          applyClassifierBest(data, via);
        }
      } catch (e) {
        if (seq !== imageClassifySeq.current) return;
        console.error(e);
        setDetectionHint(
          "Классификатор по фото недоступен. Опишите проблему текстом — категория подставится сама."
        );
      } finally {
        if (seq === imageClassifySeq.current) setDetectionBusy(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [
    newPointImageFile,
    newPointText,
    showAddPanel,
    applyClassifierBest,
  ]);

  const normalizePlacemarks = (list) => {
    if (!Array.isArray(list)) return [];
    return list
      .map((m) => {
        const lat = Number(m.latitude);
        const lng = Number(m.longitude);
        return { ...m, latitude: lat, longitude: lng };
      })
      .filter(
        (m) =>
          Number.isFinite(m.latitude) &&
          Number.isFinite(m.longitude) &&
          Math.abs(m.latitude) <= 90 &&
          Math.abs(m.longitude) <= 180
      );
  };

  const loadMarkers = async (bbox) => {
    try {
      setLoading(true);
      const params = { layer: mapLayer };
      if (bbox) {
        params.sw_lat = bbox.swLat;
        params.sw_lng = bbox.swLng;
        params.ne_lat = bbox.neLat;
        params.ne_lng = bbox.neLng;
      }
      const data = await getMarkers(params);
      let raw = normalizePlacemarks(
        Array.isArray(data) ? data : data?.markers || []
      );

      // Свои pending/rejected не попадают в публичный слой — показываем автору на карте
      if (user?.id && (mapLayer === "active" || mapLayer === "all")) {
        try {
          const mine = await getMyMarkers();
          const mineList = normalizePlacemarks(mine?.markers || []);
          const seen = new Set(raw.map((m) => m.id));
          for (const m of mineList) {
            const st = (m.status || "pending").toLowerCase();
            if (
              !seen.has(m.id) &&
              (st === "pending" || st === "rejected")
            ) {
              raw.push(m);
              seen.add(m.id);
            }
          }
        } catch {
          /* профильные метки не критичны для карты */
        }
      }

      setPlacemarks(raw);
      if (raw.length === 0 && !bbox) {
        console.info("[map] markers loaded: 0 for layer", mapLayer);
      }
    } catch (error) {
      console.error("Error loading markers:", error);
      setPlacemarks([]);
      showToast(
        error.message?.includes("fetch")
          ? "Не удалось загрузить метки. Запущен ли backend на :8080?"
          : "Ошибка загрузки меток",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    stripYmapsBuiltInControls(map);

    const fitMap = () => {
      try {
        map.container.fitToViewport();
      } catch {
        /* */
      }
    };
    fitMap();
    const t = setTimeout(fitMap, 100);
    const t2 = setTimeout(fitMap, 400);

    const onBounds = () => {
      try {
        const c = map.getCenter();
        saveMapView([c[0], c[1]], map.getZoom());
      } catch {
        /* */
      }
    };
    map.events.add("boundschange", onBounds);
    window.addEventListener("resize", fitMap);

    return () => {
      clearTimeout(t);
      clearTimeout(t2);
      window.removeEventListener("resize", fitMap);
      try {
        map.events.remove("boundschange", onBounds);
      } catch {
        /* */
      }
    };
  }, [mapReady]);

  useEffect(() => {
    if (!showAddPanel) return undefined;
    const d = loadMarkerDraft();
    if (!d) return undefined;
    if (d.text) setNewPointText(d.text);
    if (d.problemDomainKey) setProblemDomainKey(d.problemDomainKey);
    if (Array.isArray(d.coords) && d.coords.length === 2) {
      setSelectedCoords(d.coords);
    }
    if (d.text || d.problemDomainKey) {
      showToast("Восстановлен черновик", "info");
    }
    return undefined;
  }, [showAddPanel]);

  useEffect(() => {
    if (!showAddPanel) return undefined;
    const t = setTimeout(() => {
      saveMarkerDraft({
        text: newPointText,
        coords: selectedCoords,
        problemDomainKey,
      });
    }, 500);
    return () => clearTimeout(t);
  }, [showAddPanel, newPointText, selectedCoords, problemDomainKey]);

  const handleMarkerUpdated = useCallback((updated) => {
    setSelectedMarker(updated);
    setPlacemarks((prev) =>
      prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
    );
  }, []);

  const loadMarkersRef = useRef(loadMarkers);
  loadMarkersRef.current = loadMarkers;

  useRealtime({
    enabled: !!user,
    onMarkerCreated: () => loadMarkersRef.current?.(),
    onMarkerUpdated: (p) => {
      loadMarkersRef.current?.();
      if (p?.deleted && selectedMarker?.id === p.id) setSelectedMarker(null);
    },
    onNotification: () => {
      window.dispatchEvent(new CustomEvent("yandexmap:notifications"));
    },
  });

  const handleMapClick = (event) => {
    const user = localStorage.getItem("user");
    if (!user) {
      showToast("Чтобы добавить проблему — войдите в аккаунт.", "error");
      return;
    }

    const coords = event.get("coords");
    setSelectedCoords(coords);
    setNewPointText("");
    setNewPointImage(null);
    setNewPointImageFile(null);
    setProblemDomainKey("");
    setAiConfidence(null);
    skipAutoSelectsRef.current = false;
    setDetectionLine(null);
    setDetectionConfidence(null);
    setDetectionVia(null);
    setDetectionHint(
      "Введите описание — направление подставится автоматически."
    );
    setDetectionBusy(false);
    textClassifySeq.current += 1;
    imageClassifySeq.current += 1;
    setShowAddPanel(true);
  };

  const handleSuggestAI = async () => {
    if (!newPointText.trim()) {
      showToast(
        "Сначала опишите проблему — или прикрепите фото с подписью/текстом.",
        "error"
      );
      return;
    }
    try {
      setAiSuggesting(true);
      skipAutoSelectsRef.current = false;
      const data = await classifyProblemText(newPointText);
      if (!data.best?.domain_key) {
        showToast(
          "Направление не определено. Выберите вручную или уточните описание.",
          "error"
        );
        return;
      }
      applyClassifierBest(data, "по тексту (вручную)");
    } catch (e) {
      console.error(e);
      showToast(
        "Классификатор недоступен. Запустите classifier/serve.py (порт 5055).",
        "error"
      );
    } finally {
      setAiSuggesting(false);
    }
  };

  const handleMarkerClick = (marker) => {
    setSelectedMarker(marker);
  };

  const submitReview = async () => {
    if (!selectedMarker || !user) {
      showToast("Войдите в аккаунт, чтобы оставить отзыв.", "error");
      return;
    }
    if (user.id === selectedMarker.user_id) {
      showToast("Нельзя оценивать собственное обращение.", "error");
      return;
    }
    if (reviewRating < 1 || reviewRating > 5) {
      showToast("Выберите оценку от 1 до 5.", "error");
      return;
    }
    setReviewSaving(true);
    try {
      const res = await postMarkerReview(selectedMarker.id, {
        rating: reviewRating,
        comment: reviewComment,
      });
      const rc = res.review_count ?? 0;
      const ra = res.review_avg;
      setPlacemarks((prev) =>
        prev.map((p) =>
          p.id === selectedMarker.id
            ? {
                ...p,
                review_count: rc,
                review_avg:
                  ra != null ? Number(ra) : p.review_avg,
              }
            : p
        )
      );
      setSelectedMarker((m) =>
        m && m.id === selectedMarker.id
          ? {
              ...m,
              review_count: rc,
              review_avg: ra != null ? Number(ra) : m.review_avg,
            }
          : m
      );
      const sum = await getMarkerReviewSummary(selectedMarker.id);
      const listData = await listMarkerReviews(selectedMarker.id, {
        limit: 8,
        offset: 0,
      });
      const m = await getMyMarkerReview(selectedMarker.id);
      setReviewBlock({
        summary: sum,
        mine: m?.review ?? null,
        list: listData.reviews || [],
        loading: false,
        err: "",
      });
      showToast(`Спасибо за оценку ${reviewRating}`, "success");
    } catch (e) {
      showToast(e.message || "Не удалось сохранить отзыв", "error");
    } finally {
      setReviewSaving(false);
    }
  };

  const goToMyLocation = () => {
    if (!navigator.geolocation) {
      showToast("Геолокация недоступна в браузере", "error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = [pos.coords.latitude, pos.coords.longitude];
        const map = mapInstanceRef.current;
        if (map) {
          map.setCenter(c, 16, { duration: 300 });
          saveMapView(c, 16);
        }
        showToast("Центр карты — ваше местоположение", "success");
      },
      () => showToast("Не удалось определить местоположение", "error"),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const shareSelectedMarker = async () => {
    if (!selectedMarker?.id) return;
    const url = `${window.location.origin}${window.location.pathname}?marker=${selectedMarker.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Ссылка скопирована", "success");
    } catch {
      showToast(url, "success");
    }
  };

  const closeModal = () => {
    if (location.search.includes("marker=")) {
      history.replace("/");
    }
    setSelectedMarker(null);
    setReviewBlock({
      summary: null,
      mine: null,
      list: [],
      loading: false,
      err: "",
    });
    setReviewComment("");
    setReviewRating(4);
  };

  const resetAddPanel = () => {
    setShowAddPanel(false);
    setNewPointText("");
    setNewPointImage(null);
    setNewPointImageFile(null);
    setSelectedCoords(null);
    setProblemDomainKey("");
    setAiConfidence(null);
    setImageGps(null);
    setPickAddress("");
    setPickAddressLoading(true);
    skipAutoSelectsRef.current = false;
    setDetectionLine(null);
    setDetectionConfidence(null);
    setDetectionVia(null);
    setDetectionHint(null);
  };

  const finishCreateSuccess = async () => {
    clearMarkerDraft();
    await loadMarkers();
    resetAddPanel();
    showToast(
      "Заявка отправлена на модерацию. Статус — в профиле и уведомлениях.",
      "success"
    );
    window.dispatchEvent(new CustomEvent("yandexmap:notifications"));
  };

  const submitMarkerPayload = async (markerData) => {
    await createMarker(markerData);
    await finishCreateSuccess();
  };

  const addPoint = async (forceCreate = false) => {
    if (!newPointText.trim()) {
      showToast("Введите описание проблемы", "error");
      return;
    }
    if (!selectedCoords?.length) {
      showToast("Укажите точку на карте", "error");
      return;
    }

    try {
      setUploading(true);
      let imageUrl = null;

      if (newPointImageFile) {
        try {
          imageUrl = await uploadImageApi(newPointImageFile);
        } catch (uploadError) {
          console.error("Image upload failed:", uploadError);
          showToast(
            "Ошибка загрузки изображения. Метка будет добавлена без фото.",
            "error"
          );
        }
      }

      const markerData = {
        text: newPointText.trim(),
        latitude: selectedCoords[0],
        longitude: selectedCoords[1],
        image_url: imageUrl,
        force_create: !!forceCreate,
      };
      if (imageGps) {
        markerData.image_latitude = imageGps.latitude;
        markerData.image_longitude = imageGps.longitude;
      }
      if (problemDomainKey) {
        markerData.domain_key = problemDomainKey;
        markerData.group_key = "";
        markerData.issue_key = "";
        if (aiConfidence != null) {
          markerData.ai_confidence = aiConfidence;
        }
      }

      await submitMarkerPayload(markerData);
    } catch (error) {
      if (error.code === "nearby_exists") {
        setNearbyPrompt({
          markers: error.nearbyMarkers || [],
        });
        return;
      }
      console.error("Error adding point:", error);
      showToast(error.message || "Ошибка при добавлении метки", "error");
    } finally {
      setUploading(false);
    }
  };

  const joinNearbyMarker = (id) => {
    setNearbyPrompt(null);
    resetAddPanel();
    setSelectedMarker(
      placemarks.find((p) => Number(p.id) === Number(id)) || { id }
    );
    history.push(`/?marker=${id}`);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast("Файл слишком большой. Максимальный размер: 5MB", "error");
      return;
    }

    setNewPointImageFile(file);
    setImageGps(null);
    readImageGps(file).then(setImageGps);
    skipAutoSelectsRef.current = false;
    const reader = new FileReader();
    reader.onload = () => {
      setNewPointImage(reader.result);
    };
    reader.onerror = () => {
      showToast("Ошибка чтения файла", "error");
    };
    reader.readAsDataURL(file);
  };

  const selectedCategoryLabels = selectedMarker
    ? findCategoryLabels(taxonomy, selectedMarker.domain_key)
    : null;

  const handleDeleteMarker = async () => {
    if (!selectedMarker?.id || !user) return;
    const canDelete =
      selectedMarker.user_id === user.id ||
      user.is_moderator ||
      user.is_admin;
    if (!canDelete) return;
    if (
      !window.confirm(
        "Удалить это обращение? Действие нельзя отменить."
      )
    ) {
      return;
    }
    setDeletingMarker(true);
    try {
      await deleteMarker(selectedMarker.id);
      showToast("Обращение удалено", "success");
      setSelectedMarker(null);
      await loadMarkers();
    } catch (e) {
      showToast(e.message || "Не удалось удалить", "error");
    } finally {
      setDeletingMarker(false);
    }
  };

  return (
    <div className="map-page page-aurora">
      <MapHeader />

      <div
        className={`map-container${dockExpanded ? " map-container--dock-open" : ""}`}
      >
        <div className="map-ymaps-layer">
        <YMaps
          query={{
            apikey: "e99fcd77-5ec6-4928-85ff-47ddb2f50012",
            load: "package.full",
          }}
        >
          <YmapsApiBridge onReady={setYmapsApi} />
          <Map
            defaultState={mapDefault}
            width="100%"
            height="100%"
            options={{
              controls: [],
              suppressMapOpenBlock: true,
            }}
            onClick={handleMapClick}
            instanceRef={(ref) => {
              mapInstanceRef.current = ref;
              setMapReady(!!ref);
              if (ref) stripYmapsBuiltInControls(ref);
            }}
          >
            {!showHeatmap && filteredPlacemarks.length > 0 && (
              <Clusterer
                key={`cluster-${mapLayer}-${filteredPlacemarks.length}-${filteredPlacemarks[0]?.id ?? 0}`}
                options={{
                  preset: "islands#invertedRedClusterIcons",
                  groupByCoordinates: false,
                  gridSize: 64,
                }}
              >
                {filteredPlacemarks.map((p) => (
                    <Placemark
                      key={`pm-${p.id}`}
                      geometry={[p.latitude, p.longitude]}
                      properties={{
                        balloonContent: buildMarkerBalloonHtml(p, taxonomy),
                        hintContent: p.text || "Метка",
                      }}
                      options={{
                        preset: getMarkerPreset(
                          p.domain_key,
                          taxonomy,
                          p.status
                        ),
                        openBalloonOnClick: true,
                      }}
                      onClick={() => handleMarkerClick(p)}
                    />
                  ))}
              </Clusterer>
            )}
          </Map>
        </YMaps>
        </div>

        <div className="map-tools" role="toolbar" aria-label="Инструменты карты">
          <div className="map-tools-bar">
            <button
              type="button"
              className="map-tool-btn map-tool-btn--icon"
              title="Моё местоположение"
              aria-label="Моё местоположение"
              onClick={goToMyLocation}
            >
              <svg
                className="map-tool-btn__icon"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"
                />
              </svg>
            </button>
            <span className="map-tools-divider" aria-hidden="true" />
            <button
              type="button"
              className={`map-tool-btn${mapLegendOpen ? " is-active" : ""}`}
              title="Информация о карте"
              aria-expanded={mapLegendOpen}
              aria-controls="map-info-panel"
              onClick={() => setMapLegendOpen((v) => !v)}
            >
              <svg
                className="map-tool-btn__icon"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
                />
              </svg>
              <span>Информация</span>
            </button>
            {user ? (
              <button
                type="button"
                className={`map-tool-btn${mapMineOnly ? " is-active" : ""}`}
                title="Только мои обращения"
                aria-pressed={mapMineOnly}
                onClick={() => setMapMineOnly((v) => !v)}
              >
                <svg
                  className="map-tool-btn__icon"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
                  />
                </svg>
                <span>Мои</span>
              </button>
            ) : null}
          </div>

        {mapLegendOpen ? (
          <div
            id="map-info-panel"
            className="map-legend-panel"
            role="region"
            aria-label="Информация о карте"
          >
            <div className="map-legend-panel__head">
              <span className="map-legend-panel__title">Информация</span>
              <button
                type="button"
                className="map-legend-panel__close"
                aria-label="Закрыть"
                onClick={() => setMapLegendOpen(false)}
              >
                ×
              </button>
            </div>
            <h3>Статусы</h3>
            <ul className="map-legend-list">
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <li key={key}>
                  <span
                    className={`map-legend-dot map-legend-dot--${key}`}
                    aria-hidden
                  />
                  {label}
                </li>
              ))}
            </ul>
            <h3>Категории</h3>
            <ul className="map-legend-list">
              {(taxonomy?.domains || []).map((d) => (
                <li key={d.key}>
                  <span className="map-legend-swatch" aria-hidden>
                    ●
                  </span>
                  {d.label_ru}
                  <span className="map-legend-meta">
                    {markerPresetLabel(
                      getMarkerPreset(d.key, taxonomy, "approved")
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        </div>

        {!loading &&
        !showHeatmap &&
        placemarks.length === 0 ? (
          <div className="map-empty-hint" role="status">
            <p>На карте нет обращений для слоя «{mapLayer === "resolved" ? "Решённые" : mapLayer === "all" ? "Все" : "Активные"}».</p>
            <p className="map-empty-hint-sub">
              Новые заявки со статусом «На проверке» видны только вам после отправки.
            </p>
            {mapLayer !== "all" ? (
              <button
                type="button"
                className="map-empty-hint-btn"
                onClick={() => setMapLayer("all")}
              >
                Показать все публичные
              </button>
            ) : null}
          </div>
        ) : null}

        {!loading &&
        !showHeatmap &&
        placemarks.length > 0 &&
        hasActiveFilters &&
        filteredPlacemarks.length === 0 ? (
          <div className="map-empty-hint" role="status">
            <p>Нет обращений по выбранным фильтрам</p>
            <button
              type="button"
              className="map-empty-hint-btn"
              onClick={() => {
                setMapMineOnly(false);
                setMapDomainFilter("");
                setMapSearch("");
                setServerSearchMarkers(null);
              }}
            >
              Сбросить фильтры
            </button>
          </div>
        ) : null}

        {user && !showAddPanel && (
          <button
            type="button"
            className={`map-fab-add${showAddPanel ? " map-fab-add--panel-open" : ""}`}
            title="Новое обращение"
            onClick={() => {
              setDockExpanded(false);
            }}
          >
            + Обращение
          </button>
        )}

        <div className="map-dock-wrap">
          <button
            type="button"
            className={`map-dock-toggle${dockExpanded ? " is-open" : ""}${
              mapSearch.trim() || mapDomainFilter ? " has-active-filter" : ""
            }`}
            aria-expanded={dockExpanded}
            onClick={() => setDockExpanded((v) => !v)}
          >
            <span className="map-dock-toggle-icon" aria-hidden="true">
              {dockExpanded ? "▾" : "▴"}
            </span>
            {dockExpanded ? "Скрыть панель" : "Поиск и фильтры"}
          </button>

          {dockExpanded ? (
        <div className="map-bottom-dock is-expanded" role="region" aria-label="Управление картой">
          <input
            type="search"
            className="map-dock-search"
            placeholder="Поиск обращений…"
            value={mapSearch}
            onChange={(e) => setMapSearch(e.target.value)}
            aria-busy={searchLoading}
          />
          {searchLoading && mapSearch.trim().length >= 2 ? (
            <p className="map-dock-search-hint">Поиск на сервере…</p>
          ) : null}

          <div className="map-dock-tabs" role="tablist" aria-label="Режим карты">
            <button
              type="button"
              role="tab"
              aria-selected={!showHeatmap}
              className={`map-dock-tab${!showHeatmap ? " is-active" : ""}`}
              onClick={() => setShowHeatmap(false)}
            >
              Метки
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={showHeatmap}
              className={`map-dock-tab map-dock-tab--heat${
                showHeatmap ? " is-active" : ""
              }`}
              disabled={heatmapLoading || !mapReady || !ymapsApi}
              onClick={() => setShowHeatmap(true)}
            >
              {heatmapLoading
                ? !mapReady || !ymapsApi
                  ? "Карта…"
                  : "Загрузка…"
                : "Теплокарта"}
            </button>
          </div>

          {!showHeatmap ? (
            <div className="map-dock-layers" role="tablist" aria-label="Статус обращений">
              {[
                { key: "active", label: "Активные" },
                { key: "resolved", label: "Решённые" },
                { key: "all", label: "Все" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  role="tab"
                  aria-selected={mapLayer === opt.key}
                  className={`map-dock-layer${mapLayer === opt.key ? " is-active" : ""}`}
                  onClick={() => setMapLayer(opt.key)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="map-dock-hint">
              Красные зоны — больше обращений. Нажмите «Метки», чтобы вернуться.
            </p>
          )}

          <div className="map-dock-footer">
            <button
              type="button"
              className={`map-dock-filter${mapDomainFilter ? " has-filter" : ""}`}
              aria-expanded={mapFiltersOpen}
              onClick={() => setMapFiltersOpen((v) => !v)}
            >
              Фильтр
              {mapDomainFilter
                ? ` · ${
                    (taxonomy?.domains || []).find(
                      (d) => d.key === mapDomainFilter
                    )?.label_ru || ""
                  }`
                : ""}
            </button>
            {mapStats ? (
              <span className="map-dock-stats">
                {mapStats.active ?? 0} акт. · {mapStats.resolved ?? 0} реш.
              </span>
            ) : null}
          </div>

          {mapFiltersOpen ? (
            <div className="map-dock-filters">
              <div className="map-dock-filters-head">
                <span>Тип проблемы</span>
                <button
                  type="button"
                  onClick={() => {
                    setMapDomainFilter("");
                    setMapFiltersOpen(false);
                  }}
                >
                  Сбросить
                </button>
              </div>
              <div className="map-dock-chips">
                <button
                  type="button"
                  className={`map-dock-chip${!mapDomainFilter ? " is-active" : ""}`}
                  onClick={() => setMapDomainFilter("")}
                >
                  Все
                </button>
                {(taxonomy?.domains || []).map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    className={`map-dock-chip${
                      mapDomainFilter === d.key ? " is-active" : ""
                    }`}
                    onClick={() =>
                      setMapDomainFilter((k) => (k === d.key ? "" : d.key))
                    }
                  >
                    {d.label_ru}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
          ) : null}
        </div>
      </div>
      {/* Модальное окно выбранной метки */}
      {selectedMarker && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className={`modal-content${selectedMarker.image_url ? " modal-content--wide" : ""}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-problem-title"
          >
            <button
              type="button"
              className="modal-close"
              onClick={closeModal}
              aria-label="Закрыть"
            >
              ×
            </button>

            <header className="modal-header modal-header--polished">
              <p className="modal-eyebrow">Обращение на карте</p>
              <h2 id="modal-problem-title" className="modal-title">
                Детали проблемы
              </h2>
              <div className="modal-meta-row">
                <span className="modal-author">
                  {selectedMarker.user_email || "Анонимный пользователь"}
                </span>
                <span className="modal-meta-sep" aria-hidden="true">
                  ·
                </span>
                <time
                  className="modal-time"
                  dateTime={selectedMarker.created_at}
                >
                  {new Date(selectedMarker.created_at).toLocaleDateString(
                    "ru-RU",
                    {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )}
                </time>
              </div>
            </header>

            {selectedMarker.image_url && !selectedMarker.image_after_url && (
              <div className="modal-hero">
                <img
                  src={`${API_ORIGIN}${selectedMarker.image_url}`}
                  alt=""
                  className="modal-hero-img"
                  decoding="async"
                />
              </div>
            )}

            <div className="modal-body modal-body--polished">
              <MarkerModalToolbar
                marker={selectedMarker}
                user={user}
                onShare={shareSelectedMarker}
              />

              {selectedCategoryLabels && (
                <div className="modal-chip-wrap">
                  <span className="modal-chip">
                    {formatCategoryLine(selectedCategoryLabels)}
                  </span>
                  {selectedMarker.ai_confidence != null && (
                    <span className="modal-chip-ai">
                      ИИ {Number(selectedMarker.ai_confidence).toFixed(2)}
                    </span>
                  )}
                </div>
              )}
              <div className="modal-status-row">
                <span
                  className={`modal-status-badge modal-status-badge--${selectedMarker.status || "pending"}`}
                >
                  {STATUS_LABELS[selectedMarker.status] ||
                    selectedMarker.status}
                </span>
                {formatDueLine(selectedMarker) ? (
                  <span
                    className={`modal-due-line${selectedMarker.is_overdue ? " modal-due-line--overdue" : ""}`}
                  >
                    {formatDueLine(selectedMarker)}
                  </span>
                ) : null}
              </div>

              {selectedMarker.status === "rejected" &&
                selectedMarker.moderator_note && (
                  <div className="modal-mod-note">
                    <strong>Комментарий модератора:</strong>{" "}
                    {selectedMarker.moderator_note}
                  </div>
                )}

              <section className="modal-section">
                <h3 className="modal-section-title">Описание</h3>
                <div className="modal-prose">
                  {selectedMarker.text || "Без описания"}
                </div>
              </section>

              <MarkerBeforeAfter
                marker={selectedMarker}
                user={user}
                onUpdated={handleMarkerUpdated}
              />

              <section className="modal-section modal-reviews-section">
                <h3 className="modal-section-title">Отзывы и оценки</h3>
                {reviewBlock.loading ? (
                  <p className="modal-reviews-muted">Загрузка…</p>
                ) : reviewBlock.err ? (
                  <p className="modal-reviews-err">{reviewBlock.err}</p>
                ) : (
                  <>
                    <div className="modal-reviews-summary">
                      {reviewBlock.summary?.count > 0 ? (
                        <>
                          <span className="modal-reviews-stars" aria-hidden="true">
                            {"★".repeat(
                              Math.round(
                                Number(reviewBlock.summary.avg) || 0
                              )
                            )}
                            <span className="modal-reviews-stars-muted">
                              {"☆".repeat(
                                5 -
                                  Math.min(
                                    5,
                                    Math.round(
                                      Number(reviewBlock.summary.avg) || 0
                                    )
                                  )
                              )}
                            </span>
                          </span>
                          <span className="modal-reviews-num">
                            {Number(reviewBlock.summary.avg).toFixed(1)} ·{" "}
                            {reviewBlock.summary.count}{" "}
                            {reviewBlock.summary.count === 1
                              ? "оценка"
                              : "оценок"}
                          </span>
                        </>
                      ) : (
                        <span className="modal-reviews-muted">
                          Пока нет оценок — будьте первым (кроме автора).
                        </span>
                      )}
                    </div>

                    {user &&
                    selectedMarker.user_id &&
                    user.id !== selectedMarker.user_id ? (
                      <div className="modal-review-form">
                        <p className="modal-reviews-label">Ваша оценка</p>
                        <div className="modal-star-row" role="group" aria-label="Оценка 1–5">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              className={`modal-star-btn${reviewRating >= n ? " modal-star-btn--on" : ""}`}
                              onClick={() => setReviewRating(n)}
                              aria-pressed={reviewRating >= n}
                              aria-label={`${n} из 5`}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                        <label className="modal-reviews-label" htmlFor="modal-review-comment">
                          Комментарий (необязательно)
                        </label>
                        <textarea
                          id="modal-review-comment"
                          className="modal-review-textarea"
                          rows={3}
                          maxLength={2000}
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          placeholder="Например: подтверждаю, здесь регулярно неудобно…"
                        />
                        <button
                          type="button"
                          className="modal-review-submit"
                          onClick={submitReview}
                          disabled={reviewSaving}
                        >
                          {reviewSaving ? "Сохранение…" : "Отправить отзыв"}
                        </button>
                        {reviewBlock.mine ? (
                          <p className="modal-reviews-hint">
                            Вы уже оставляли отзыв — повторная отправка обновит
                            оценку и текст.
                          </p>
                        ) : null}
                      </div>
                    ) : user &&
                      selectedMarker.user_id &&
                      user.id === selectedMarker.user_id ? (
                      <p className="modal-reviews-muted">
                        Автор обращения не участвует в оценке.
                      </p>
                    ) : (
                      <p className="modal-reviews-muted">
                        <Link to="/login">Войдите</Link>, чтобы оставить оценку.
                      </p>
                    )}

                    {reviewBlock.list?.length > 0 ? (
                      <ul className="modal-reviews-list">
                        {reviewBlock.list.map((r) => (
                          <li key={r.id} className="modal-review-item">
                            <div className="modal-review-item-head">
                              <span className="modal-review-email">
                                {r.user_email || `Пользователь #${r.user_id}`}
                              </span>
                              <span className="modal-review-item-stars">
                                {"★".repeat(r.rating)}
                                <span className="modal-reviews-stars-muted">
                                  {"☆".repeat(5 - r.rating)}
                                </span>
                              </span>
                            </div>
                            {r.comment ? (
                              <p className="modal-review-item-text">{r.comment}</p>
                            ) : null}
                            <time
                              className="modal-review-time"
                              dateTime={r.created_at}
                            >
                              {new Date(r.created_at).toLocaleString("ru-RU")}
                            </time>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                )}
              </section>

              <section className="modal-section modal-support-section">
                <h3 className="modal-section-title">Поддержка обращения</h3>
                {supportBlock.loading ? (
                  <p className="modal-reviews-muted">Загрузка…</p>
                ) : (
                  <>
                    <p className="modal-support-count">
                      {supportBlock.count > 0
                        ? `${supportBlock.count} человек подтвердили эту проблему`
                        : "Пока никто не подтвердил — будьте первым"}
                    </p>
                    {supportBlock.err ? (
                      <p className="modal-reviews-err">{supportBlock.err}</p>
                    ) : null}
                    {user &&
                    selectedMarker.user_id &&
                    user.id !== selectedMarker.user_id &&
                    ["approved", "in_progress", "pending"].includes(
                      selectedMarker.status || "pending"
                    ) ? (
                      <button
                        type="button"
                        className={`btn-marker-support${supportBlock.iSupported ? " btn-marker-support--on" : ""}`}
                        disabled={supportBlock.saving}
                        onClick={toggleSupport}
                      >
                        {supportBlock.saving
                          ? "…"
                          : supportBlock.iSupported
                            ? "Вы поддержали"
                            : "Я тоже столкнулся с этой проблемой"}
                      </button>
                    ) : user &&
                      selectedMarker.user_id === user.id ? (
                      <p className="modal-reviews-muted">
                        Автор не может поддержать своё обращение.
                      </p>
                    ) : (
                      <p className="modal-reviews-muted">
                        <Link to="/login">Войдите</Link>, чтобы подтвердить
                        проблему.
                      </p>
                    )}
                  </>
                )}
              </section>

              <section className="modal-section modal-section--location">
                <h3 className="modal-section-title">Место</h3>
                <p className="modal-location-address">
                  {markerAddress ||
                    "Адрес определяется…"}
                </p>
                <p className="modal-location-coords">
                  {selectedMarker.latitude?.toFixed(5) ?? "—"},{" "}
                  {selectedMarker.longitude?.toFixed(5) ?? "—"}
                </p>
              </section>

              <section className="modal-section modal-history-section">
                <h3 className="modal-section-title">История изменений</h3>
                <MarkerTimelineFull markerId={selectedMarker.id} />
              </section>
            </div>

            <footer className="modal-footer modal-footer--polished">
              {user &&
                selectedMarker.user_id === user.id &&
                (selectedMarker.status === "pending" ||
                  selectedMarker.status === "rejected") && (
                  <button
                    type="button"
                    className="btn-delete-marker"
                    disabled={deletingMarker}
                    onClick={handleDeleteMarker}
                  >
                    {deletingMarker ? "Удаление…" : "Удалить обращение"}
                  </button>
                )}
              <button
                type="button"
                className="btn-close-modal"
                onClick={closeModal}
              >
                Закрыть
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Панель добавления новой метки */}
      {showAddPanel && (
        <div className="add-panel">
          <div className="add-panel-header">
            <div>
              <h2>Новое обращение</h2>
              <p className="add-panel-location">
                {pickAddressLoading
                  ? "Определяем адрес…"
                  : pickAddress ||
                    (selectedCoords
                      ? `${selectedCoords[0]?.toFixed(5)}, ${selectedCoords[1]?.toFixed(5)}`
                      : "Точка на карте")}
              </p>
            </div>
            <button
              type="button"
              className="add-panel-close"
              aria-label="Закрыть"
              onClick={() => {
                resetAddPanel();
                textClassifySeq.current += 1;
                imageClassifySeq.current += 1;
              }}
            >
              ×
            </button>
          </div>

          <textarea
            placeholder="Опишите проблему — категория подставится сама. Если только фото с текстом (табличка, вывеска) — сначала прикрепите снимок."
            value={newPointText}
            onChange={(e) => {
              skipAutoSelectsRef.current = false;
              setNewPointText(e.target.value);
            }}
            rows={4}
          />

          <div className="category-detected-banner" aria-live="polite">
            <div className="category-detected-title">Определённое направление</div>
            {detectionBusy && (
              <div className="category-detected-loading">Анализ…</div>
            )}
            {!detectionBusy && detectionLine && (
              <>
                <div className="category-detected-path">{detectionLine}</div>
                <div className="category-detected-meta">
                  {detectionVia && <span>Источник: {detectionVia}</span>}
                  {detectionConfidence != null && (
                    <span className="category-detected-conf">
                      Уверенность: {detectionConfidence.toFixed(2)}
                    </span>
                  )}
                </div>
              </>
            )}
            {!detectionBusy && !detectionLine && detectionHint && (
              <div className="category-detected-hint">{detectionHint}</div>
            )}
          </div>

          <div className="file-upload">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              id="image-upload"
            />
            <label htmlFor="image-upload" className="upload-label">
              Загрузите фото
            </label>
          </div>

          {newPointImage && (
            <div className="image-preview">
              <img src={newPointImage} alt="Предпросмотр" />
              <button
                className="remove-image"
                onClick={() => {
                  setNewPointImage(null);
                  setNewPointImageFile(null);
                  setImageGps(null);
                  skipAutoSelectsRef.current = false;
                  imageClassifySeq.current += 1;
                }}
              >
                ✕ Удалить фото
              </button>
            </div>
          )}

          <div className="panel-taxonomy">
            <label>Направление</label>
            <select
              value={problemDomainKey}
              onChange={(e) => {
                skipAutoSelectsRef.current = true;
                const key = e.target.value;
                setProblemDomainKey(key);
                setAiConfidence(null);
                if (!key) {
                  setDetectionLine(null);
                  setDetectionVia(null);
                  setDetectionConfidence(null);
                  return;
                }
                const d = taxonomy.domains.find((x) => x.key === key);
                if (!d) return;
                const line = formatCategoryLine({ domain: d.label_ru });
                suppressTextClassifyRef.current = true;
                setTimeout(() => {
                  suppressTextClassifyRef.current = false;
                }, 900);
                setDetectionLine(line);
                setDetectionVia("выбор вручную");
                setDetectionConfidence(null);
                setDetectionHint(null);
                setNewPointText((prev) => {
                  if (!prev.trim()) return line;
                  return prev;
                });
              }}
            >
              <option value="">Не выбрано</option>
              {taxonomy.domains.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label_ru}
                </option>
              ))}
            </select>
          </div>

          <div className="panel-ai-row">
            <button
              type="button"
              className="btn-ai-suggest"
              onClick={handleSuggestAI}
              disabled={aiSuggesting || uploading || detectionBusy}
            >
              {aiSuggesting ? "Обновление…" : "Обновить"}
            </button>
          </div>

          <div className="panel-buttons">
            <button
              className="btn-cancel"
              onClick={() => {
                resetAddPanel();
                textClassifySeq.current += 1;
                imageClassifySeq.current += 1;
              }}
              disabled={uploading}
            >
              Отмена
            </button>
            {imageGps && selectedCoords ? (
              <p className="add-panel-exif-hint">
                GPS с фото учтён при проверке места на карте.
              </p>
            ) : null}
            <button
              className="btn-add"
              onClick={() => addPoint(false)}
              disabled={uploading || !newPointText.trim()}
            >
              {uploading ? "Добавление..." : "Добавить"}
            </button>
          </div>
        </div>
      )}

      {nearbyPrompt ? (
        <div className="nearby-overlay" role="dialog" aria-modal="true" onClick={() => setNearbyPrompt(null)}>
          <div className="nearby-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Рядом уже есть обращения</h3>
            <p>Поддержите существующую заявку вместо дубля метки.</p>
            <ul className="nearby-list">
              {(nearbyPrompt.markers || []).map((m) => (
                <li key={m.id}>
                  <button type="button" className="nearby-item-btn" onClick={() => joinNearbyMarker(m.id)}>
                    <span>{m.text?.slice(0, 80)}{(m.text?.length > 80 && "…") || ""}</span>
                    <span className="nearby-meta">~{Math.round(m.distance_m || 0)} м · {m.support_count ?? 0} поддержек</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="nearby-actions">
              <button type="button" className="btn-cancel" onClick={() => setNearbyPrompt(null)}>Отмена</button>
              <button type="button" className="btn-add" disabled={uploading} onClick={() => { setNearbyPrompt(null); addPoint(true); }}>Всё равно создать</button>
            </div>
          </div>
        </div>
      ) : null}

      {loading && (
        <div className="loading-overlay">
          <div>Загрузка меток...</div>
        </div>
      )}

      {showOnboarding ? (
        <OnboardingModal onClose={() => setShowOnboarding(false)} />
      ) : null}
    </div>
  );
};

export default YandexMap;
