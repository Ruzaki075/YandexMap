import React, { useState, useEffect, useRef, useCallback } from "react";
import { YMaps, Map, Placemark } from "@pbe/react-yandex-maps";
import issueTaxonomy from "@issue-taxonomy";
import MapHeader from "./MapHeader.jsx";
import {
  classifyProblemText,
  classifyProblemImage,
} from "../../services/api.js";
import {
  findCategoryLabels,
  formatCategoryLine,
} from "../../utils/issueLabels.js";
import "./YandexMap.css";

const TEXT_CLASSIFY_MIN_LEN = 8;

const USER_COLORS = [
  "islands#redIcon",
  "islands#blueIcon",
  "islands#greenIcon",
  "islands#orangeIcon",
  "islands#violetIcon",
  "islands#darkBlueIcon",
  "islands#pinkIcon",
];

const getColorByUser = (userId) => {
  if (!userId) return "islands#grayIcon";
  return USER_COLORS[userId % USER_COLORS.length];
};

const API_ORIGIN = "http://localhost:8080";

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
      '<div style="font-size:11px;font-weight:600;color:#047857;margin:0 0 8px;">Одобрено · на карте</div>'
    );
  } else if (st === "resolved") {
    chunks.push(
      '<div style="font-size:11px;font-weight:600;color:#1d4ed8;margin:0 0 8px;">Отмечено как решено</div>'
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

const YandexMap = () => {
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

  const skipAutoSelectsRef = useRef(false);
  const suppressTextClassifyRef = useRef(false);
  const textClassifySeq = useRef(0);
  const imageClassifySeq = useRef(0);


  const mapDefault = {
    center: [55.751244, 37.618423],
    zoom: 11,
  };

  useEffect(() => {
    loadMarkers();
  }, []);

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

  const loadMarkers = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:8080/api/markers");
      if (!response.ok) throw new Error("Failed to load markers");
      const data = await response.json();

      // Защита от формата ответа; на карте не показываем отклонённые модератором
      const raw = Array.isArray(data) ? data : data.markers || [];
      setPlacemarks(raw.filter((m) => (m.status || "pending") !== "rejected"));
    } catch (error) {
      console.error("Error loading markers:", error);
      alert("Ошибка загрузки меток");
    } finally {
      setLoading(false);
    }
  };

  const handleMapClick = (event) => {
    const user = localStorage.getItem("user");
    if (!user) {
      alert("Чтобы добавить проблему — войдите в аккаунт.");
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
      alert("Сначала опишите проблему — или прикрепите фото с подписью/текстом.");
      return;
    }
    try {
      setAiSuggesting(true);
      skipAutoSelectsRef.current = false;
      const data = await classifyProblemText(newPointText);
      if (!data.best?.domain_key) {
        alert(
          "Направление не определено. Выберите вручную или уточните описание."
        );
        return;
      }
      applyClassifierBest(data, "по тексту (вручную)");
    } catch (e) {
      console.error(e);
      alert(
        "Классификатор недоступен. Запустите classifier/serve.py (порт 5055)."
      );
    } finally {
      setAiSuggesting(false);
    }
  };

  const handleMarkerClick = (marker) => {
    setSelectedMarker(marker);
  };

  const closeModal = () => {
    setSelectedMarker(null);
  };

  const uploadImage = async (file) => {
    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch("http://localhost:8080/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to upload image");
      const data = await response.json();
      return data.image_url;
    } catch (error) {
      console.error("Upload error:", error);
      throw error;
    }
  };

  const addPoint = async () => {
    if (!newPointText.trim()) {
      alert("Введите описание проблемы");
      return;
    }

    try {
      setUploading(true);
      let imageUrl = null;

      if (newPointImage) {
        try {
          const response = await fetch(newPointImage);
          const blob = await response.blob();
          const file = new File([blob], "image.jpg", { type: "image/jpeg" });
          imageUrl = await uploadImage(file);
        } catch (uploadError) {
          console.error("Image upload failed:", uploadError);
          alert("Ошибка загрузки изображения. Метка будет добавлена без фото.");
        }
      }

      const userStr = localStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;

      if (!user || !user.id) {
        alert("Ошибка: пользователь не авторизован");
        return;
      }

      const markerData = {
        text: newPointText,
        latitude: selectedCoords[0],
        longitude: selectedCoords[1],
        image_url: imageUrl,
        user_id: user.id,
      };
      if (problemDomainKey) {
        markerData.domain_key = problemDomainKey;
        markerData.group_key = "";
        markerData.issue_key = "";
        if (aiConfidence != null) {
          markerData.ai_confidence = aiConfidence;
        }
      }

      console.log("Отправляем маркер:", markerData);

      const response = await fetch("http://localhost:8080/api/markers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(markerData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create marker: ${errorText}`);
      }

      const result = await response.json();
      console.log("Маркер создан:", result);

      await loadMarkers();

      setShowAddPanel(false);
      setNewPointText("");
      setNewPointImage(null);
      setNewPointImageFile(null);
      setSelectedCoords(null);
      setProblemDomainKey("");
      setAiConfidence(null);
      setNewPointImageFile(null);
      skipAutoSelectsRef.current = false;
      setDetectionLine(null);
      setDetectionConfidence(null);
      setDetectionVia(null);
      setDetectionHint(null);

      alert("Метка успешно добавлена!");
    } catch (error) {
      console.error("Error adding point:", error);
      alert("Ошибка при добавлении метки: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Файл слишком большой. Максимальный размер: 5MB");
      return;
    }

    setNewPointImageFile(file);
    skipAutoSelectsRef.current = false;
    const reader = new FileReader();
    reader.onload = () => {
      setNewPointImage(reader.result);
    };
    reader.onerror = () => {
      alert("Ошибка чтения файла");
    };
    reader.readAsDataURL(file);
  };

  const selectedCategoryLabels = selectedMarker
    ? findCategoryLabels(issueTaxonomy, selectedMarker.domain_key)
    : null;

  return (
    <div className="map-page">
      <MapHeader />

      <div className="map-container">
        <YMaps query={{ apikey: "e99fcd77-5ec6-4928-85ff-47ddb2f50012" }}>
          <Map
            defaultState={mapDefault}
            width="100%"
            height="100%"
            onClick={handleMapClick}
          >
            {Array.isArray(placemarks) &&
              placemarks.map((p) => {
                return (
                <Placemark
                  key={p.id}
                  geometry={[p.latitude, p.longitude]}
                  properties={{
                    balloonContent: buildMarkerBalloonHtml(p, issueTaxonomy),
                    hintContent: p.text || "Метка",
                  }}
                  options={{
                    preset: getColorByUser(p.user_id),
                    openBalloonOnClick: true,
                  }}
                  onClick={() => handleMarkerClick(p)}
                />
              );
              })}
          </Map>
        </YMaps>
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

            {selectedMarker.image_url && (
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

              <section className="modal-section">
                <h3 className="modal-section-title">Описание</h3>
                <div className="modal-prose">
                  {selectedMarker.text || "Без описания"}
                </div>
              </section>

              <section className="modal-section modal-section--coords">
                <h3 className="modal-section-title">Координаты</h3>
                <div className="modal-coords">
                  <span>
                    {selectedMarker.latitude?.toFixed(6) ?? "—"},{" "}
                    {selectedMarker.longitude?.toFixed(6) ?? "—"}
                  </span>
                </div>
              </section>
            </div>

            <footer className="modal-footer modal-footer--polished">
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
          <h2>Добавление проблемы</h2>

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
                const d = issueTaxonomy.domains.find((x) => x.key === key);
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
              {issueTaxonomy.domains.map((d) => (
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
                setShowAddPanel(false);
                setProblemDomainKey("");
                setAiConfidence(null);
                setNewPointImageFile(null);
                skipAutoSelectsRef.current = false;
                setDetectionLine(null);
                setDetectionConfidence(null);
                setDetectionVia(null);
                setDetectionHint(null);
                textClassifySeq.current += 1;
                imageClassifySeq.current += 1;
              }}
              disabled={uploading}
            >
              Отмена
            </button>
            <button
              className="btn-add"
              onClick={addPoint}
              disabled={uploading || !newPointText.trim()}
            >
              {uploading ? "Добавление..." : "Добавить"}
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div>Загрузка меток...</div>
        </div>
      )}
    </div>
  );
};

export default YandexMap;
