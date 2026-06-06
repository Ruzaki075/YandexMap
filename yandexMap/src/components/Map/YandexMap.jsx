import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { useLocation, useHistory } from "react-router-dom";
import {
  YMaps,
  Map,
  Clusterer,
  useYMaps,
} from "@pbe/react-yandex-maps";
import MapPlacemark from "./MapPlacemark.jsx";
import MainPageLayout from "./MainPageLayout.jsx";
import mapUi from "../../styles/MainPage.module.css";
import {
  IconAlertCircle,
  IconCamera,
  IconHeart,
  IconMessageSquare,
  IconPin,
  IconPlus,
  IconUser,
  IconX,
} from "../Icons.jsx";
import { useBottomSheetDrag } from "../../hooks/useBottomSheetDrag.js";
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
  extractUploadedImageUrl,
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
import { MarkerTimelineFull } from "./MarkerModalExtras.jsx";
import MarkerIssueCard from "./MarkerIssueCard.jsx";
import StatusTimeline from "./StatusTimeline.jsx";
import OfficialResponse from "./OfficialResponse.jsx";
import "./StatusTimeline.css";
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
import {
  loadMapView,
  saveMapView,
  DEFAULT_MAP_VIEW,
} from "../../utils/mapViewStorage.js";
import {
  compareMarkersByLikesDesc,
  likeWord,
  splitMarkerAddress,
} from "../../utils/mainPageUtils.js";
import {
  buildClustererOptions,
  getCategoryColor,
  getMarkerPreset,
  markerPresetLabel,
} from "../../utils/markerColors.js";
import OnboardingModal, {
  isOnboardingDone,
} from "../Onboarding/OnboardingModal.jsx";
import "./YandexMap.css";
import "./MapCreateSheet.css";
import "./MarkerDetailModal.css";

const TEXT_CLASSIFY_MIN_LEN = 8;
const LIST_PAGE_SIZE = 10;


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
      `<div style="font-size:12px;font-weight:600;color:#cc0000;margin-bottom:8px;">${sc} ${likeWord(sc)}</div>`
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

  const [mapLayer, setMapLayer] = useState("active");
  const [mapDomainFilter, setMapDomainFilter] = useState("");
  const [mapSearch, setMapSearch] = useState("");
  const [mapStats, setMapStats] = useState(null);
  const [deletingMarker, setDeletingMarker] = useState(false);
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
  const [createStep, setCreateStep] = useState(1);
  const [statusChecks, setStatusChecks] = useState({
    pending: true,
    approved: true,
    in_progress: true,
    resolved: true,
    rejected: true,
  });
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const listPage = Math.max(
    1,
    parseInt(new URLSearchParams(location.search).get("page") || "1", 10)
  );
  const mapInstanceRef = useRef(null);
  const onCloseMarkerRef = useRef(() => {});
  const onCloseCreateRef = useRef(() => {});
  const createSheetDrag = useBottomSheetDrag(() => onCloseCreateRef.current());
  const heatmapRef = useRef(null);
  const skipAutoSelectsRef = useRef(false);
  const suppressTextClassifyRef = useRef(false);
  const textClassifySeq = useRef(0);
  const imageClassifySeq = useRef(0);
  const showAddPanelRef = useRef(false);
  const createStepRef = useRef(1);
  /** Не подставлять координаты из черновика при новом открытии формы */
  const skipDraftCoordsRef = useRef(false);

  useEffect(() => {
    showAddPanelRef.current = showAddPanel;
  }, [showAddPanel]);

  useEffect(() => {
    createStepRef.current = createStep;
  }, [createStep]);

  const mapDefault = loadMapView() || DEFAULT_MAP_VIEW;

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
    reverseGeocode(selectedCoords, ymapsApi).then((addr) => {
      if (!cancelled) {
        setPickAddress(addr);
        setPickAddressLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [showAddPanel, selectedCoords, ymapsApi]);

  useEffect(() => {
    if (!selectedMarker?.latitude || !selectedMarker?.longitude) {
      setMarkerAddress("");
      return;
    }
    let cancelled = false;
    reverseGeocode(
      [selectedMarker.latitude, selectedMarker.longitude],
      ymapsApi
    ).then(
      (addr) => {
        if (!cancelled) setMarkerAddress(addr);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [selectedMarker?.id, selectedMarker?.latitude, selectedMarker?.longitude, ymapsApi]);

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
    list = list.filter((m) => statusChecks[m.status || "pending"] !== false);
    if (dateFrom) {
      const from = new Date(dateFrom);
      list = list.filter((m) => m.created_at && new Date(m.created_at) >= from);
    }
    if (dateTo) {
      const to = new Date(`${dateTo}T23:59:59`);
      list = list.filter((m) => m.created_at && new Date(m.created_at) <= to);
    }
    return [...list].sort(compareMarkersByLikesDesc);
  }, [
    placemarks,
    serverSearchMarkers,
    mapDomainFilter,
    mapSearch,
    mapMineOnly,
    user?.id,
    statusChecks,
    dateFrom,
    dateTo,
  ]);

  const listTotalPages = Math.max(
    1,
    Math.ceil(filteredPlacemarks.length / LIST_PAGE_SIZE)
  );
  const safePage = Math.min(listPage, listTotalPages);
  const paginatedMarkers = useMemo(() => {
    const start = (safePage - 1) * LIST_PAGE_SIZE;
    return filteredPlacemarks.slice(start, start + LIST_PAGE_SIZE);
  }, [filteredPlacemarks, safePage]);

  const categoryCounts = useMemo(() => {
    const counts = { all: placemarks.length };
    placemarks.forEach((m) => {
      const k = m.domain_key || "other";
      counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  }, [placemarks]);

  const inProgressCount = useMemo(
    () => placemarks.filter((m) => m.status === "in_progress").length,
    [placemarks]
  );

  const setListPage = (p) => {
    const next = Math.max(1, Math.min(p, listTotalPages));
    const params = new URLSearchParams(location.search);
    if (next <= 1) params.delete("page");
    else params.set("page", String(next));
    const q = params.toString();
    history.push({ pathname: "/", search: q ? `?${q}` : "" });
  };

  const handleResetFilters = () => {
    setMapMineOnly(false);
    setMapDomainFilter("");
    setMapSearch("");
    setServerSearchMarkers(null);
    setDateFrom("");
    setDateTo("");
    setShowHeatmap(false);
    setMapLayer("active");
    setStatusChecks({
      pending: true,
      approved: true,
      in_progress: true,
      resolved: true,
      rejected: true,
    });
    setListPage(1);
  };

  const handleStatusCheckAll = (checked) => {
    setStatusChecks({
      pending: checked,
      approved: checked,
      in_progress: checked,
      resolved: checked,
      rejected: checked,
    });
  };

  const focusMarkerOnMap = (m) => {
    const map = mapInstanceRef.current;
    if (map && m?.latitude != null && m?.longitude != null) {
      try {
        map.setCenter([m.latitude, m.longitude], 16, { duration: 400 });
      } catch {
        /* */
      }
    }
    handleMarkerClick(m);
  };

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
    const initialCount = Number(selectedMarker.support_count) || 0;
    let cancelled = false;
    (async () => {
      setSupportBlock((s) => ({
        ...s,
        count: initialCount,
        loading: true,
        err: "",
      }));
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

  /** Кластеры: красные круги с числом (после загрузки API — кастомный layout). */
  const clustererOptions = useMemo(
    () => buildClustererOptions(ymapsApi),
    [ymapsApi]
  );

  const isOwnMarker =
    user &&
    selectedMarker?.user_id &&
    user.id === selectedMarker.user_id;

  const toggleLike = async () => {
    if (!selectedMarker?.id) return;
    if (!user) {
      history.push("/login");
      return;
    }
    if (isOwnMarker) {
      showToast("Нельзя поставить лайк своему обращению", "error");
      return;
    }
    setSupportBlock((s) => ({ ...s, saving: true, err: "" }));
    try {
      const res = supportBlock.iSupported
        ? await deleteMarkerSupport(selectedMarker.id)
        : await postMarkerSupport(selectedMarker.id);
      const cnt = res.count ?? supportBlock.count;
      const liked = !supportBlock.iSupported;
      setSupportBlock({
        count: cnt,
        iSupported: liked,
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
        liked ? "Лайк поставлен" : "Лайк убран",
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
    const skipCoords = skipDraftCoordsRef.current;
    skipDraftCoordsRef.current = false;
    if (d.text) setNewPointText(d.text);
    if (d.problemDomainKey) setProblemDomainKey(d.problemDomainKey);
    if (
      !skipCoords &&
      Array.isArray(d.coords) &&
      d.coords.length === 2
    ) {
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

    /* Шаг 1: адрес определяется только после клика по карте */
    if (showAddPanelRef.current && createStepRef.current === 1) {
      setSelectedCoords(coords);
      setPickAddress("");
      setPickAddressLoading(true);
      return;
    }

    setSelectedCoords(coords);
    setPickAddress("");
    setPickAddressLoading(true);
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
    skipDraftCoordsRef.current = true;
    setCreateStep(1);
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
    setSupportBlock({
      count: 0,
      iSupported: false,
      loading: false,
      saving: false,
      err: "",
    });
  };
  onCloseMarkerRef.current = closeModal;

  const resetAddPanel = () => {
    setShowAddPanel(false);
    setCreateStep(1);
    setNewPointText("");
    setNewPointImage(null);
    setNewPointImageFile(null);
    setSelectedCoords(null);
    setProblemDomainKey("");
    setAiConfidence(null);
    setImageGps(null);
    setPickAddress("");
    setPickAddressLoading(false);
    skipAutoSelectsRef.current = false;
    setDetectionLine(null);
    setDetectionConfidence(null);
    setDetectionVia(null);
    setDetectionHint(null);
  };
  onCloseCreateRef.current = resetAddPanel;

  /** FAB: форма создания (точку на карте выбирают на шаге 1, без подстановки центра). */
  const openCreateFlow = () => {
    if (!user) {
      showToast("Войдите, чтобы сообщить о проблеме", "info");
      history.push("/login");
      return;
    }
    setSelectedCoords(null);
    setPickAddress("");
    setPickAddressLoading(false);
    skipDraftCoordsRef.current = true;
    setCreateStep(1);
    setShowAddPanel(true);
  };

  /** Открытие формы с других страниц: /?create=1 */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("create") !== "1") return;
    if (!user) {
      showToast("Войдите, чтобы сообщить о проблеме", "info");
      history.replace("/login");
      return;
    }
    setSelectedCoords(null);
    setPickAddress("");
    setPickAddressLoading(false);
    skipDraftCoordsRef.current = true;
    setCreateStep(1);
    setShowAddPanel(true);
    history.replace("/");
  }, [location.search, user, history]);

  /** Геолокация: точка и адрес обращения */
  const pickLocationFromGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      showToast("Геолокация недоступна в браузере", "error");
      return;
    }
    setPickAddress("");
    setPickAddressLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = [pos.coords.latitude, pos.coords.longitude];
        setSelectedCoords(c);
        const map = mapInstanceRef.current;
        if (map) {
          map.setCenter(c, 17, { duration: 300 });
          saveMapView(c, 17);
        }
        showToast("Местоположение определено", "success");
      },
      () => {
        setPickAddressLoading(false);
        showToast(
          "Не удалось определить местоположение. Разрешите доступ в браузере или укажите точку на карте.",
          "error"
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }, []);

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
          const uploadResult = await uploadImageApi(newPointImageFile);
          imageUrl = extractUploadedImageUrl(uploadResult);
        } catch (uploadError) {
          console.error("Image upload failed:", uploadError);
          showToast(
            "Ошибка загрузки изображения. Метка будет добавлена без фото.",
            "error"
          );
        }
      }

      const lat = Number(selectedCoords[0]);
      const lon = Number(selectedCoords[1]);

      const markerData = {
        text: newPointText.trim(),
        latitude: lat,
        longitude: lon,
        force_create: !!forceCreate,
      };
      if (imageUrl && typeof imageUrl === "string") {
        markerData.image_url = imageUrl;
      }
      if (pickAddress?.trim()) {
        markerData.address_text = pickAddress.trim();
      }
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
    <>
      <MainPageLayout
        taxonomy={taxonomy}
        mapDomainFilter={mapDomainFilter}
        setMapDomainFilter={setMapDomainFilter}
        categoryCounts={categoryCounts}
        mapSearch={mapSearch}
        setMapSearch={setMapSearch}
        searchLoading={searchLoading}
        mapStats={mapStats}
        inProgressCount={inProgressCount}
        statusChecks={statusChecks}
        onStatusCheckChange={(key, val) =>
          setStatusChecks((s) => ({ ...s, [key]: val }))
        }
        onStatusCheckAll={handleStatusCheckAll}
        paginatedMarkers={paginatedMarkers}
        filteredTotal={filteredPlacemarks.length}
        page={safePage}
        onPageChange={setListPage}
        totalPages={listTotalPages}
        onFocusMarker={focusMarkerOnMap}
        onReportClick={openCreateFlow}
        onResetFilters={handleResetFilters}
        mapLayer={mapLayer}
        setMapLayer={setMapLayer}
        heatmapLoading={heatmapLoading}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        mobileSidebarOpen={mobileSidebarOpen}
        setMobileSidebarOpen={setMobileSidebarOpen}
        showHeatmap={showHeatmap}
        setShowHeatmap={setShowHeatmap}
      >
        <div className={mapUi.mapInner}>
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
                key={`cluster-${mapLayer}-${ymapsApi ? "v2" : "v1"}-${filteredPlacemarks.length}`}
                options={clustererOptions}
              >
                {filteredPlacemarks.map((p) => (
                  <MapPlacemark
                    key={p.id}
                    marker={p}
                    taxonomy={taxonomy}
                    onMarkerClick={handleMarkerClick}
                  />
                ))}
              </Clusterer>
            )}
          </Map>
        </YMaps>
        </div>

        <div className="map-tools map-tools--compact" role="toolbar" aria-label="Инструменты карты">
          <div className="map-tools-bar">
            <button
              type="button"
              className="map-tool-btn map-tool-btn--icon"
              title="Моё местоположение"
              aria-label="Моё местоположение"
              onClick={goToMyLocation}
            >
              <IconPin size={18} className="map-tool-btn__icon" />
            </button>
            <span className="map-tools-divider" aria-hidden="true" />
            <button
              type="button"
              className={`map-tool-btn map-tool-btn--icon${mapLegendOpen ? " is-active" : ""}`}
              title="Информация о карте"
              aria-expanded={mapLegendOpen}
              aria-controls="map-info-panel"
              onClick={() => setMapLegendOpen((v) => !v)}
            >
              <IconAlertCircle size={16} className="map-tool-btn__icon" />
              <span className="map-tool-btn__label">Информация</span>
            </button>
            <button
              type="button"
              className={`map-tool-btn map-tool-btn--icon map-tool-btn--mine${
                mapMineOnly ? " is-active" : ""
              }${user ? "" : " map-tool-btn--mine-hidden"}`}
              title="Только мои обращения"
              aria-label="Только мои обращения"
              aria-pressed={user ? mapMineOnly : undefined}
              tabIndex={user ? 0 : -1}
              disabled={!user}
              onClick={() => user && setMapMineOnly((v) => !v)}
            >
              <IconUser size={16} className="map-tool-btn__icon" />
              <span className="map-tool-btn__label">Мои</span>
            </button>
          </div>

        {mapLegendOpen ? (
          <>
            <button
              type="button"
              className="map-legend-backdrop"
              aria-label="Закрыть информацию"
              onClick={() => setMapLegendOpen(false)}
            />
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
                <IconX size={18} />
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
                  <span
                    className="map-legend-swatch"
                    style={{ color: getCategoryColor(d.key, taxonomy) }}
                    aria-hidden
                  >
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
          </>
        ) : null}
        </div>

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

        {!showAddPanel && !selectedMarker ? (
          <button
            type="button"
            className={mapUi.mapFab}
            title="Сообщить о проблеме"
            aria-label="Сообщить о проблеме"
            onClick={openCreateFlow}
          >
            <IconPlus size={24} className="fab-icon" />
          </button>
        ) : null}
        </div>
      </MainPageLayout>
      {/* Карточка маркера — модалка по центру */}
      {selectedMarker && (
        <div
          className="marker-detail-overlay"
          role="presentation"
          onClick={closeModal}
        >
          <div
            className="marker-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="map-sheet-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="marker-detail-close"
              aria-label="Закрыть"
              onClick={closeModal}
            >
              <IconX size={18} />
            </button>
            <div className="marker-detail-scroll">
              <MarkerIssueCard
                marker={selectedMarker}
                addressFull={
                  markerAddress || selectedMarker.address_text || ""
                }
                categoryLabels={selectedCategoryLabels}
                supportBlock={supportBlock}
                user={user}
                isOwnMarker={isOwnMarker}
                onToggleLike={toggleLike}
                onShare={shareSelectedMarker}
                onMarkerUpdated={handleMarkerUpdated}
              >
                {selectedMarker.status === "rejected" &&
                selectedMarker.moderator_note ? (
                  <div className="modal-mod-note">
                    <strong>Комментарий модератора:</strong>{" "}
                    {selectedMarker.moderator_note}
                  </div>
                ) : null}

                {selectedMarker.ai_confidence != null ? (
                  <p className="ag-issue-meta-extra">
                    Уверенность ИИ:{" "}
                    {Number(selectedMarker.ai_confidence).toFixed(2)}
                  </p>
                ) : null}

                <section className="modal-section">
                  <h3 className="modal-section-title">Статус обращения</h3>
                  <StatusTimeline
                    markerId={selectedMarker.id}
                    currentStatus={selectedMarker.status}
                  />
                </section>

                <OfficialResponse markerId={selectedMarker.id} />

                <section className="modal-section modal-section--location">
                  <h3 className="modal-section-title">На карте</h3>
                  <p className="modal-location-coords">
                    {selectedMarker.latitude?.toFixed(5) ?? "—"},{" "}
                    {selectedMarker.longitude?.toFixed(5) ?? "—"}
                  </p>
                </section>

                <section className="modal-section modal-history-section">
                  <h3 className="modal-section-title">История изменений</h3>
                  <MarkerTimelineFull markerId={selectedMarker.id} />
                </section>

                {user &&
                selectedMarker.user_id === user.id &&
                (selectedMarker.status === "pending" ||
                  selectedMarker.status === "rejected") ? (
                  <button
                    type="button"
                    className="btn-delete-marker"
                    disabled={deletingMarker}
                    onClick={handleDeleteMarker}
                    style={{ margin: "0.75rem 0" }}
                  >
                    {deletingMarker ? "Удаление…" : "Удалить обращение"}
                  </button>
                ) : null}
              </MarkerIssueCard>
            </div>

            <footer className="marker-detail-footer">
              <button
                type="button"
                className={`map-sheet-btn map-sheet-btn--primary${
                  supportBlock.iSupported ? " map-sheet-btn--like-on" : ""
                }`}
                disabled={
                  supportBlock.saving ||
                  supportBlock.loading ||
                  isOwnMarker
                }
                onClick={toggleLike}
              >
                <IconHeart
                  size={18}
                  filled={supportBlock.iSupported}
                />
                {supportBlock.saving
                  ? "…"
                  : supportBlock.iSupported
                    ? "Лайк поставлен"
                    : "Поставить лайк"}
                {!supportBlock.loading && supportBlock.count > 0
                  ? ` · ${supportBlock.count}`
                  : ""}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Форма создания — многошаговый bottom sheet */}
      {showAddPanel && (
        <div
          className={`map-create-overlay${
            createStep === 1 ? " map-create-overlay--pick" : ""
          }`}
          role="presentation"
          onClick={
            createStep === 1
              ? undefined
              : () => {
                  resetAddPanel();
                  textClassifySeq.current += 1;
                  imageClassifySeq.current += 1;
                }
          }
        >
          <div
            className="map-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="map-create-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="map-create-header">
              <div>
                <p className="map-create-eyebrow">Новое обращение</p>
                <h2 id="map-create-title" className="map-create-title">
                  {createStep === 1
                    ? "Где проблема?"
                    : createStep === 2
                      ? "Что случилось?"
                      : createStep === 3
                        ? "Добавьте фото"
                        : "Проверьте и отправьте"}
                </h2>
              </div>
              <button
                type="button"
                className="map-create-close"
                aria-label="Закрыть"
                onClick={() => {
                  resetAddPanel();
                  textClassifySeq.current += 1;
                  imageClassifySeq.current += 1;
                }}
              >
                <IconX size={18} />
              </button>
            </div>

            <div className="map-create-step-labels" aria-hidden="true">
              {["Место", "Описание", "Фото", "Отправка"].map((label, idx) => {
                const n = idx + 1;
                return (
                  <span
                    key={label}
                    className={`map-create-step-label${
                      n < createStep ? " is-done" : ""
                    }${n === createStep ? " is-current" : ""}`}
                  >
                    {label}
                  </span>
                );
              })}
            </div>

            <div className="map-create-progress" aria-label="Шаги">
              {[1, 2, 3, 4].map((n) => (
                <span
                  key={n}
                  className={`map-create-progress-seg${
                    n < createStep ? " is-done" : ""
                  }${n === createStep ? " is-current" : ""}`}
                />
              ))}
            </div>

            <div className="map-create-body">
              {createStep === 1 ? (
                <>
                  <p className="map-create-step-hint">
                    Укажите место: «Моё местоположение» или клик по карте
                    (кликните мимо этого окна). Адрес подставится после выбора
                    точки.
                  </p>
                  <button
                    type="button"
                    className="map-create-geo-btn map-create-geo-btn--primary"
                    onClick={pickLocationFromGeolocation}
                    disabled={pickAddressLoading}
                  >
                    <IconPin size={18} />
                    {pickAddressLoading
                      ? "Определяем…"
                      : "Определить моё местоположение"}
                  </button>
                  <div className="map-create-location-card">
                    <span className="map-create-location-icon" aria-hidden>
                      <IconPin size={22} />
                    </span>
                    <div className="map-create-location-body">
                      {pickAddressLoading ? (
                        <p className="map-create-location-text is-loading">
                          Определяем адрес…
                        </p>
                      ) : selectedCoords && pickAddress ? (
                        <>
                          <p className="map-create-location-line1">
                            {splitMarkerAddress(pickAddress).line1}
                          </p>
                          {splitMarkerAddress(pickAddress).line2 ? (
                            <p className="map-create-location-line2">
                              {splitMarkerAddress(pickAddress).line2}
                            </p>
                          ) : null}
                        </>
                      ) : selectedCoords ? (
                        <p className="map-create-location-text">
                          {Number(selectedCoords[0]).toFixed(5)},{" "}
                          {Number(selectedCoords[1]).toFixed(5)}
                          <span className="map-create-location-sub">
                            {" "}
                            — адрес не найден, сдвиньте точку на карте
                          </span>
                        </p>
                      ) : (
                        <p className="map-create-location-text">
                          Точка ещё не выбрана
                        </p>
                      )}
                      <div className="map-create-location-actions">
                        {selectedCoords && !pickAddressLoading ? (
                          <button
                            type="button"
                            className="map-create-refresh-addr"
                            onClick={() => {
                              setPickAddressLoading(true);
                              reverseGeocode(selectedCoords, ymapsApi).then(
                                (addr) => {
                                  setPickAddress(addr);
                                  setPickAddressLoading(false);
                                  if (!addr) {
                                    showToast(
                                      "Не удалось определить адрес. Выберите точку на карте точнее.",
                                      "info"
                                    );
                                  }
                                }
                              );
                            }}
                          >
                            Обновить адрес
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {!selectedCoords ? (
                    <p className="map-create-map-tip">
                      <IconPin size={16} />
                      Нажмите на карту под окном — адрес подставится автоматически
                    </p>
                  ) : null}
                </>
              ) : null}

              {createStep === 2 ? (
                <>
                  <p className="map-create-step-hint">
                    Опишите проблему — направление подставится автоматически.
                  </p>
                  <textarea
                    placeholder="Например: яма на проезжей части, сломанный светофор, мусор во дворе…"
                    value={newPointText}
                    onChange={(e) => {
                      skipAutoSelectsRef.current = false;
                      setNewPointText(e.target.value);
                    }}
                    rows={5}
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
                  <div className="panel-ai-row">
                    <button
                      type="button"
                      className="btn-ai-suggest"
                      onClick={handleSuggestAI}
                      disabled={aiSuggesting || uploading || detectionBusy}
                    >
                      {aiSuggesting ? "Обновление…" : "Обновить категорию"}
                    </button>
                  </div>
                </>
              ) : null}

              {createStep === 3 ? (
                <>
                  <p className="map-create-step-hint">
                    Фото необязательно, но ускоряет модерацию и улучшает классификацию.
                  </p>
                  <div className="file-upload">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      id="image-upload"
                    />
                    <label htmlFor="image-upload" className="upload-label">
                      <span className="map-create-dropzone">
                        <span className="map-create-dropzone-icon" aria-hidden>
                          <IconCamera size={24} />
                        </span>
                        <span className="map-create-dropzone-title">
                          Выберите или перетащите фото
                        </span>
                        <span className="map-create-dropzone-hint">
                          JPG, PNG · до 10 МБ
                        </span>
                      </span>
                    </label>
                  </div>

                  {newPointImage ? (
                    <div className="image-preview">
                      <img src={newPointImage} alt="Предпросмотр" />
                      <button
                        type="button"
                        className="remove-image"
                        onClick={() => {
                          setNewPointImage(null);
                          setNewPointImageFile(null);
                          setImageGps(null);
                          skipAutoSelectsRef.current = false;
                          imageClassifySeq.current += 1;
                        }}
                      >
                        <IconX size={14} /> Удалить
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}

              {createStep === 4 ? (
                <>
                  <p className="map-create-step-hint">
                    Проверьте данные перед отправкой на модерацию.
                  </p>
                  <div className="map-create-summary">
                    <div className="map-create-summary-row map-create-summary-row--highlight">
                      <span className="map-create-summary-icon" aria-hidden>
                        <IconPin size={18} />
                      </span>
                      <div>
                        <span className="map-create-summary-label">Адрес</span>
                        <p className="map-create-summary-value">
                          {pickAddress || "Адрес не определён"}
                        </p>
                      </div>
                    </div>
                    <div className="map-create-summary-row">
                      <span className="map-create-summary-icon" aria-hidden>
                        <IconMessageSquare size={18} />
                      </span>
                      <div>
                        <span className="map-create-summary-label">Описание</span>
                        <p className="map-create-summary-value">
                          {newPointText.trim() || "—"}
                        </p>
                      </div>
                    </div>
                    {newPointImage ? (
                      <div className="map-create-summary-row">
                        <span className="map-create-summary-icon" aria-hidden>
                          <IconCamera size={18} />
                        </span>
                        <div>
                          <span className="map-create-summary-label">Фото</span>
                          <p className="map-create-summary-value">Прикреплено</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="panel-taxonomy">
                    <label htmlFor="create-domain-select">Направление</label>
                    <select
                      id="create-domain-select"
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
                  {imageGps && selectedCoords ? (
                    <p className="add-panel-exif-hint">
                      GPS с фото учтён при проверке места.
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="map-create-nav">
              <button
                type="button"
                className="map-sheet-btn map-sheet-btn--outline"
                onClick={() => {
                  if (createStep <= 1) {
                    resetAddPanel();
                    textClassifySeq.current += 1;
                    imageClassifySeq.current += 1;
                  } else {
                    setCreateStep((s) => s - 1);
                  }
                }}
                disabled={uploading}
              >
                {createStep <= 1 ? "Отмена" : "Назад"}
              </button>
              {createStep < 4 ? (
                <button
                  type="button"
                  className="map-sheet-btn map-sheet-btn--primary"
                  onClick={() => {
                    if (createStep === 1 && !selectedCoords) {
                      showToast("Укажите точку на карте", "error");
                      return;
                    }
                    if (createStep === 2 && !newPointText.trim()) {
                      showToast("Введите описание проблемы", "error");
                      return;
                    }
                    setCreateStep((s) => s + 1);
                  }}
                >
                  Далее
                </button>
              ) : (
                <button
                  type="button"
                  className="map-sheet-btn map-sheet-btn--primary"
                  onClick={() => addPoint(false)}
                  disabled={uploading || !newPointText.trim()}
                >
                  {uploading ? "Отправка…" : "Отправить обращение"}
                </button>
              )}
            </div>
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
                    <span className="nearby-meta">~{Math.round(m.distance_m || 0)} м · {m.support_count ?? 0} {likeWord(m.support_count ?? 0)}</span>
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
    </>
  );
};

export default YandexMap;
