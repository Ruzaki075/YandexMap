import { API_URL } from "../config.js";
import { isTokenExpired } from "../utils/authToken.js";

const CLASSIFIER_URL =
  import.meta.env.VITE_AI_CLASSIFIER_URL ||
  import.meta.env.VITE_CLASSIFIER_URL ||
  "http://localhost:5055";

export const classifyProblemText = async (text, topK = 3) => {
  const response = await fetch(`${CLASSIFIER_URL}/classify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, top_k: topK }),
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(t || "Classifier request failed");
  }
  return response.json();
};

/** Классификация по фото: на сервере читается текст с картинки (EasyOCR), затем тот же классификатор. */
export const classifyProblemImage = async (file, topK = 3) => {
  const fd = new FormData();
  fd.append("image", file);
  fd.append("top_k", String(topK));
  const response = await fetch(`${CLASSIFIER_URL}/classify_image`, {
    method: "POST",
    body: fd,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "classify_image failed");
  }
  return data;
};

export const getToken = () => {
  const token = localStorage.getItem("token");

  if (!token || token === "undefined" || token === "null") {
    return null;
  }
  if (isTokenExpired(token)) {
    return null;
  }

  return token;
};

export const login = async (email, password) => {
  try {
    console.log("Отправляем запрос на логин:", email, password);
    
    const response = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email,
        password: password
      }),
    });

    console.log("Статус ответа логина:", response.status);
    console.log("Заголовки ответа:", response.headers);

    const responseText = await response.text();
    console.log("Тело ответа логина:", responseText);

    if (!response.ok) {
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(`Ошибка входа: ${JSON.stringify(errorData)}`);
      } catch {
        throw new Error(`Ошибка входа: ${response.status} ${responseText}`);
      }
    }

    const data = JSON.parse(responseText);
    console.log("Ответ сервера при логине:", data);
    
    return data;
  } catch (error) {
    console.error("Ошибка в login:", error);
    throw error;
  }
};

export const register = async (email, password) => {
  try {
    console.log("Регистрируем пользователя:", email, password);
    
    const response = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email,
        password: password
      }),
    });

    console.log("Статус ответа регистрации:", response.status);
    console.log("Заголовки ответа:", response.headers);

    const responseText = await response.text();
    console.log("Тело ответа регистрации:", responseText);

    if (!response.ok) {
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(`Ошибка регистрации: ${JSON.stringify(errorData)}`);
      } catch {
        throw new Error(`Ошибка регистрации: ${response.status} ${responseText}`);
      }
    }

    const data = JSON.parse(responseText);
    console.log("Регистрация успешна:", data);
    return data;
  } catch (error) {
    console.error("Ошибка в register:", error);
    throw error;
  }
};

export const getMarkers = async (params = {}) => {
  try {
    const qs = new URLSearchParams();
    if (params.page != null && params.page > 0) {
      qs.set("page", String(params.page));
    }
    if (params.page_size != null && params.page_size > 0) {
      qs.set("page_size", String(params.page_size));
    }
    if (params.domain_key != null && params.domain_key !== "") {
      qs.set("domain_key", String(params.domain_key));
    }
    if (params.status != null && params.status !== "") {
      qs.set("status", String(params.status));
    }
    if (params.layer != null && params.layer !== "") {
      qs.set("layer", String(params.layer));
    }
    if (params.overdue === true || params.overdue === "1") {
      qs.set("overdue", "1");
    }
    if (params.sw_lat != null) qs.set("sw_lat", String(params.sw_lat));
    if (params.sw_lng != null) qs.set("sw_lng", String(params.sw_lng));
    if (params.ne_lat != null) qs.set("ne_lat", String(params.ne_lat));
    if (params.ne_lng != null) qs.set("ne_lng", String(params.ne_lng));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";

    const response = await fetch(`${API_URL}/markers${suffix}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Ошибка при загрузке маркеров: ${response.status} ${errorText}`
      );
    }

    return response.json();
  } catch (error) {
    console.error("Ошибка в getMarkers:", error);
    throw error;
  }
};

/** Все мои метки (любой статус) — для профиля */
export const getMyMarkers = async () => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const response = await fetch(`${API_URL}/markers/mine`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(t || "Ошибка загрузки моих меток");
  }
  return response.json();
};

export const getNotifications = async ({ limit = 40, offset = 0 } = {}) => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const response = await fetch(`${API_URL}/notifications?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(t || "Ошибка уведомлений");
  }
  return response.json();
};

export const getNotificationsUnreadCount = async () => {
  const token = getToken();
  if (!token) return 0;
  const response = await fetch(`${API_URL}/notifications/unread-count`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return 0;
  const data = await response.json();
  return typeof data.unread === "number" ? data.unread : 0;
};

export const markNotificationRead = async (id) => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const response = await fetch(`${API_URL}/notifications/${id}/read`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(t || "Ошибка");
  }
  return response.json();
};

export const markAllNotificationsRead = async () => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const response = await fetch(`${API_URL}/notifications/read-all`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(t || "Ошибка");
  }
  return response.json();
};

/** Пагинированный список для панели модерации (GET /api/moderation/markers) */
export const getModerationMarkers = async (params = {}, { signal } = {}) => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const qs = new URLSearchParams();
  if (params.page != null && params.page > 0) qs.set("page", String(params.page));
  if (params.page_size != null) qs.set("page_size", String(params.page_size));
  if (params.status) qs.set("status", String(params.status));
  if (params.category) qs.set("category", String(params.category));
  if (params.overdue) qs.set("overdue", "1");
  if (params.has_photo) qs.set("has_photo", "1");
  if (params.many_supports) qs.set("many_supports", "1");
  if (params.supports_min) qs.set("supports_min", String(params.supports_min));
  if (params.unresolved) qs.set("unresolved", "1");
  if (params.my_checks) qs.set("my_checks", "1");
  if (params.q) qs.set("q", String(params.q));
  if (params.sort) qs.set("sort", String(params.sort));
  if (params.date_from) qs.set("date_from", String(params.date_from));
  if (params.date_to) qs.set("date_to", String(params.date_to));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const response = await fetch(`${API_URL}/moderation/markers${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (response.status === 401 || response.status === 403) {
    const t = await response.text();
    throw new Error(t || "Нет прав модератора");
  }
  if (!response.ok) {
    const t = await response.text();
    throw new Error(t || "Ошибка загрузки очереди");
  }
  return response.json();
};

/** Сводка для модерации/админа (GET /api/moderation/stats) */
export const getModerationStats = async () => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const response = await fetch(`${API_URL}/moderation/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401 || response.status === 403) {
    const t = await response.text();
    throw new Error(t || "Нет прав модератора");
  }
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Ошибка статистики");
  }
  return response.json();
};

/** Жалобы пользователей для модерации (GET /api/moderation/abuse-reports) */
export const getModerationAbuseReports = async (params = {}, { signal } = {}) => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const qs = new URLSearchParams();
  if (params.page != null && params.page > 0) qs.set("page", String(params.page));
  if (params.page_size != null) qs.set("page_size", String(params.page_size));
  if (params.status) qs.set("status", String(params.status));
  if (params.reason) qs.set("reason", String(params.reason));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const response = await fetch(`${API_URL}/moderation/abuse-reports${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (response.status === 401 || response.status === 403) {
    const t = await response.text();
    throw new Error(t || "Нет прав модератора");
  }
  if (!response.ok) {
    const t = await response.text();
    throw new Error(t || "Ошибка загрузки жалоб");
  }
  return response.json();
};

/** Закрыть жалобу: dismissed | actioned */
export const patchModerationAbuseReport = async (id, status) => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const response = await fetch(`${API_URL}/moderation/abuse-reports/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(t || "Ошибка обновления жалобы");
  }
  return response.json();
};

/** Средняя оценка и число отзывов по метке */
export const getMarkerReviewSummary = async (markerId) => {
  const response = await fetch(
    `${API_URL}/markers/${markerId}/reviews/summary`
  );
  if (!response.ok) {
    const t = await response.text();
    throw new Error(t || "summary failed");
  }
  return response.json();
};

/** Мой отзыв по метке (нужен токен) */
export const getMyMarkerReview = async (markerId) => {
  const token = getToken();
  if (!token) return { review: null };
  const response = await fetch(`${API_URL}/markers/${markerId}/reviews/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) return { review: null };
  if (!response.ok) {
    const t = await response.text();
    throw new Error(t || "me failed");
  }
  return response.json();
};

/** Список отзывов */
export const listMarkerReviews = async (markerId, { limit = 10, offset = 0 } = {}) => {
  const qs = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const response = await fetch(
    `${API_URL}/markers/${markerId}/reviews?${qs}`
  );
  if (!response.ok) {
    const t = await response.text();
    throw new Error(t || "list reviews failed");
  }
  return response.json();
};

/** Оставить или изменить отзыв (1–5 звёзд, опционально комментарий) */
export const postMarkerReview = async (markerId, { rating, comment = "" }) => {
  const token = getToken();
  if (!token) throw new Error("Войдите, чтобы оставить отзыв.");
  const response = await fetch(`${API_URL}/markers/${markerId}/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ rating, comment }),
  });
  if (!response.ok) {
    const t = await response.text();
    let msg = t;
    try {
      const j = JSON.parse(t);
      if (j.error) msg = j.error;
    } catch {
      /* plain text */
    }
    throw new Error(msg || "Не удалось сохранить отзыв");
  }
  return response.json();
};

export const listMarkerComments = async (markerId) => {
  const response = await fetch(`${API_URL}/markers/${markerId}/comments`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Ошибка загрузки обсуждения");
  }
  return response.json();
};

export const postMarkerComment = async (markerId, text) => {
  const token = getToken();
  if (!token) throw new Error("Войдите, чтобы писать в обсуждении.");
  const response = await fetch(`${API_URL}/markers/${markerId}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Не удалось отправить комментарий");
  }
  return response.json();
};

export const getMapStats = async () => {
  const response = await fetch(`${API_URL}/stats/map`);
  if (!response.ok) {
    throw new Error("Ошибка загрузки статистики");
  }
  return response.json();
};

export const patchMarkerText = async (markerId, text) => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const response = await fetch(`${API_URL}/markers/${markerId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    const t = await response.text();
    let msg = t;
    try {
      const j = JSON.parse(t);
      if (j.error) msg = j.error;
    } catch {
      /* */
    }
    throw new Error(msg || "Не удалось сохранить");
  }
  return response.json();
};

export const getMarkerStatusHistory = async (markerId) => {
  const response = await fetch(`${API_URL}/markers/${markerId}/status-history`);
  if (!response.ok) {
    const t = await response.text();
    throw new Error(t || "Ошибка загрузки истории");
  }
  return response.json();
};

export const getGeoSubscriptions = async () => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const response = await fetch(`${API_URL}/geo-subscriptions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(t || "Ошибка загрузки подписок");
  }
  return response.json();
};

export const createGeoSubscription = async (payload) => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const response = await fetch(`${API_URL}/geo-subscriptions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(t || "Не удалось создать подписку");
  }
  return response.json();
};

export const deleteGeoSubscription = async (id) => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const response = await fetch(`${API_URL}/geo-subscriptions/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(t || "Не удалось удалить");
  }
  return response.json();
};

export const deleteMarker = async (markerId) => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const response = await fetch(`${API_URL}/markers/${markerId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Не удалось удалить обращение");
  }
  return response.json();
};

/** Массовая смена статуса меток (модератор) */
export const bulkPatchMarkerStatuses = async (ids, status, moderatorNote) => {
  const token = getToken();
  if (!token) throw new Error("Требуется авторизация модератора.");
  const numericIds = (ids || [])
    .map((id) => Number(id))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (numericIds.length === 0) {
    throw new Error("Нет корректных id для массового действия.");
  }
  const body = { ids: numericIds, status };
  if (moderatorNote != null && String(moderatorNote).trim() !== "") {
    body.moderator_note = String(moderatorNote).trim();
  }
  let response;
  try {
    response = await fetch(`${API_URL}/moderation/markers/bulk-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const msg = e?.message || String(e);
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
      throw new Error(
        "Нет ответа от сервера (сеть или CORS). Откройте сайт тем же адресом, что в backend CORS (localhost и 127.0.0.1 — разные), проверьте VITE_API_URL и что API запущен."
      );
    }
    throw e;
  }
  if (response.status === 401 || response.status === 403) {
    const t = await response.text();
    throw new Error(t || "Нет прав модератора");
  }
  if (!response.ok) {
    const t = await response.text();
    throw new Error(t || "Массовое обновление не выполнено");
  }
  return response.json();
};

export const patchMarkerStatus = async (
  markerId,
  status,
  moderatorNote,
  imageAfterUrl
) => {
  const token = getToken();
  if (!token) {
    throw new Error("Требуется авторизация модератора.");
  }
  const body = { status };
  if (moderatorNote != null && String(moderatorNote).trim() !== "") {
    body.moderator_note = String(moderatorNote).trim();
  }
  if (imageAfterUrl != null && String(imageAfterUrl).trim() !== "") {
    body.image_after_url = String(imageAfterUrl).trim();
  }
  const response = await fetch(`${API_URL}/markers/${markerId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (response.status === 401 || response.status === 403) {
    const t = await response.text();
    throw new Error(t || "Нет прав модератора или сессия истекла");
  }
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Не удалось обновить статус");
  }
  return response.json();
};

export const createMarker = async (markerData) => {
  const token = getToken();
  if (!token) {
    throw new Error("Требуется авторизация. Пожалуйста, войдите в систему.");
  }

  const body = JSON.stringify(markerData);
  const response = await fetch(`${API_URL}/markers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body,
  });

  const responseText = await response.text();
  let data = {};
  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(
        responseText.slice(0, 200) || "Сервер вернул некорректный ответ"
      );
    }
  }

  if (response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    throw new Error("Сессия истекла. Пожалуйста, войдите снова.");
  }

  if (response.status === 409 && data.error === "nearby_exists") {
    const err = new Error(
      data.message || "Рядом уже есть похожие обращения."
    );
    err.code = "nearby_exists";
    err.nearbyMarkers = data.nearby_markers || [];
    throw err;
  }

  if (!response.ok) {
    const msg =
      data.error ||
      data.message ||
      (typeof data === "string" ? data : null) ||
      responseText.slice(0, 200) ||
      "Ошибка при создании маркера";
    throw new Error(msg);
  }

  return data;
};

export const getMarkerSupports = async (markerId) => {
  const response = await fetch(`${API_URL}/markers/${markerId}/supports`);
  if (!response.ok) {
    throw new Error("Не удалось загрузить поддержки");
  }
  return response.json();
};

export const postMarkerSupport = async (markerId) => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const response = await fetch(`${API_URL}/markers/${markerId}/supports`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Не удалось подтвердить");
  }
  return data;
};

export const deleteMarkerSupport = async (markerId) => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const response = await fetch(`${API_URL}/markers/${markerId}/supports`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Не удалось отменить");
  }
  return data;
};

export const getNearbyMarkers = async (lat, lng, radiusM = 100) => {
  const q = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius_m: String(radiusM),
  });
  const response = await fetch(`${API_URL}/markers/nearby?${q}`);
  if (!response.ok) throw new Error("Ошибка поиска рядом");
  return response.json();
};

export const getHeatmapPoints = async (layer = "active") => {
  const q = layer ? `?layer=${encodeURIComponent(layer)}` : "";
  const response = await fetch(`${API_URL}/stats/heatmap${q}`);
  if (!response.ok) throw new Error("Ошибка тепловой карты");
  return response.json();
};

export const getLeaderboard = async () => {
  const response = await fetch(`${API_URL}/leaderboard`);
  if (!response.ok) throw new Error("Ошибка рейтинга");
  return response.json();
};

export const uploadImage = async (file) => {
  try {
    const token = getToken();
    const formData = new FormData();
    formData.append("image", file);

    const headers = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    console.log("Загружаем изображение...");

    const response = await fetch(`${API_URL}/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    console.log("Статус ответа загрузки изображения:", response.status);

    if (response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      throw new Error("Сессия истекла. Пожалуйста, войдите снова.");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ошибка при загрузке изображения: ${errorText}`);
    }

    const text = await response.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Некорректный ответ сервера при загрузке фото");
      }
    }
    return data;
  } catch (error) {
    console.error("Ошибка в uploadImage:", error);
    throw error;
  }
};

/** URL загруженного изображения из ответа /api/upload */
export function extractUploadedImageUrl(uploadResult) {
  if (!uploadResult) return null;
  if (typeof uploadResult === "string") return uploadResult;
  return uploadResult.image_url || uploadResult.url || null;
}

/** Аватар профиля (JPG/PNG/WEBP/GIF, до 2 МБ) */
export const uploadAvatar = async (file) => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const formData = new FormData();
  formData.append("image", file);
  const response = await fetch(`${API_URL}/me/avatar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!response.ok) {
    const t = await response.text();
    let msg = t;
    try {
      const j = JSON.parse(t);
      if (j.error) msg = j.error;
    } catch {
      /* */
    }
    throw new Error(msg || "Не удалось загрузить аватар");
  }
  return response.json();
};

export const deleteAvatar = async () => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const response = await fetch(`${API_URL}/me/avatar`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(t || "Не удалось удалить аватар");
  }
  return response.json();
};

/** Никнейм (display_name); пустая строка — сбросить. */
export const patchMyProfile = async (displayName) => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const response = await fetch(`${API_URL}/me/profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ display_name: displayName }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || "Не удалось сохранить никнейм");
  }
  return data;
};

export const changePassword = async (oldPassword, newPassword) => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const response = await fetch(`${API_URL}/me/password`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      old_password: oldPassword,
      new_password: newPassword,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || "Не удалось сменить пароль");
  }
  return data;
};

/** Таксономия классификаций (направления + цвет меток) */
export const getTaxonomy = async () => {
  const response = await fetch(`${API_URL}/taxonomy`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Ошибка загрузки классификаций");
  }
  return response.json();
};

/** Список классификаций для админки и модераторов */
export const getAdminClassifications = async () => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const response = await fetch(`${API_URL}/admin/classifications`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401 || response.status === 403) {
    const t = await response.text();
    throw new Error(t || "Нет прав модератора или администратора");
  }
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Ошибка загрузки классификаций");
  }
  return response.json();
};

export const createAdminClassification = async (payload) => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const response = await fetch(`${API_URL}/admin/classifications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Не удалось создать классификацию");
  }
  return response.json();
};

export const patchAdminClassification = async (key, payload) => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const response = await fetch(`${API_URL}/admin/classifications/${encodeURIComponent(key)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Не удалось обновить классификацию");
  }
  return response.json();
};

export const reorderAdminClassifications = async (keys) => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const response = await fetch(`${API_URL}/admin/classifications/reorder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ keys }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Не удалось сохранить порядок");
  }
  return response.json();
};

export const deleteAdminClassification = async (key) => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const response = await fetch(`${API_URL}/admin/classifications/${encodeURIComponent(key)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Не удалось удалить классификацию");
  }
  return response.json();
};

/** Список пользователей (только администратор) */
export const getAdminUsers = async () => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const response = await fetch(`${API_URL}/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401 || response.status === 403) {
    const t = await response.text();
    throw new Error(t || "Нет прав администратора");
  }
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Ошибка загрузки пользователей");
  }
  return response.json();
};

/** Смена ролей пользователя (только администратор) */
export const patchAdminUser = async (userId, payload) => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const response = await fetch(`${API_URL}/admin/users/${userId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (response.status === 401 || response.status === 403) {
    const t = await response.text();
    throw new Error(t || "Нет прав администратора");
  }
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Не удалось обновить пользователя");
  }
  return response.json();
};

export const searchMarkers = async (q, limit = 40) => {
  const qs = new URLSearchParams({ q, limit: String(limit) });
  const response = await fetch(`${API_URL}/search?${qs}`);
  if (!response.ok) throw new Error("Search failed");
  return response.json();
};

export const getMarkerTimeline = async (markerId) => {
  const response = await fetch(`${API_URL}/markers/${markerId}/timeline`);
  if (!response.ok) throw new Error("Timeline failed");
  return response.json();
};

export const getPublicProfile = async (userId) => {
  const response = await fetch(`${API_URL}/users/${userId}/public`);
  if (!response.ok) throw new Error("Profile not found");
  return response.json();
};

export const getUserActivity = async (userId, year) => {
  const qs = year ? `?year=${year}` : "";
  const response = await fetch(`${API_URL}/users/${userId}/activity${qs}`);
  if (!response.ok) throw new Error("Activity failed");
  return response.json();
};

export const getAnalyticsDashboard = async (days = 30) => {
  const response = await fetch(`${API_URL}/analytics/dashboard?days=${days}`);
  if (!response.ok) throw new Error("Analytics failed");
  return response.json();
};

export const getLeaderboardSeason = async (period = "week") => {
  const response = await fetch(`${API_URL}/leaderboard/season?period=${period}`);
  if (!response.ok) throw new Error("Leaderboard failed");
  return response.json();
};

export const listFavorites = async () => {
  const token = getToken();
  const response = await fetch(`${API_URL}/favorites`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Favorites failed");
  return response.json();
};

export const addFavorite = async (markerId) => {
  const token = getToken();
  const response = await fetch(`${API_URL}/favorites`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ marker_id: markerId }),
  });
  if (!response.ok) throw new Error("Favorite failed");
  return response.json();
};

export const removeFavorite = async (markerId) => {
  const token = getToken();
  const response = await fetch(`${API_URL}/favorites/${markerId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Unfavorite failed");
  return response.json();
};

export const getFavoriteStatus = async (markerId) => {
  const token = getToken();
  const response = await fetch(`${API_URL}/favorites/${markerId}/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return { favorited: false };
  return response.json();
};

export const postAbuseReport = async (payload) => {
  const token = getToken();
  if (!token) throw new Error("Войдите в аккаунт, чтобы отправить жалобу");
  const response = await fetch(`${API_URL}/abuse-reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(t || "Не удалось отправить жалобу");
  }
  return response.json();
};

export const getAdminAuditLog = async (limit = 50) => {
  const token = getToken();
  const response = await fetch(`${API_URL}/admin/audit-log?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Audit log failed");
  return response.json();
};

export const patchMarkerMeta = async (markerId, payload) => {
  const token = getToken();
  const response = await fetch(`${API_URL}/markers/${markerId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Update failed");
  return response.json();
};

export const getProfilePoints = async (limit = 30) => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const response = await fetch(`${API_URL}/profile/points?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Не удалось загрузить баллы");
  return response.json();
};

export const getProfileAchievements = async () => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const response = await fetch(`${API_URL}/profile/achievements`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Не удалось загрузить достижения");
  return response.json();
};

export const getUserAchievements = async (userId) => {
  const response = await fetch(`${API_URL}/users/${userId}/achievements`);
  if (!response.ok) throw new Error("Не удалось загрузить достижения");
  return response.json();
};

export const getOfficialResponse = async (markerId) => {
  const response = await fetch(`${API_URL}/markers/${markerId}/official-response`);
  if (!response.ok) throw new Error("Ошибка загрузки ответа ведомства");
  return response.json();
};

export const postOfficialResponse = async (markerId, payload) => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const response = await fetch(`${API_URL}/markers/${markerId}/official-response`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(t || "Не удалось сохранить ответ");
  }
  return response.json();
};

export const putOfficialResponse = async (markerId, payload) => {
  const token = getToken();
  if (!token) throw new Error("Требуется вход.");
  const response = await fetch(`${API_URL}/markers/${markerId}/official-response`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Не удалось обновить ответ");
  return response.json();
};

export const getDepartments = async () => {
  const response = await fetch(`${API_URL}/departments`);
  if (!response.ok) throw new Error("Ошибка загрузки ведомств");
  return response.json();
};

export const getPolls = async (params = {}) => {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.category) q.set("category", params.category);
  if (params.page) q.set("page", String(params.page));
  const response = await fetch(`${API_URL}/polls?${q}`);
  if (!response.ok) throw new Error("Ошибка загрузки опросов");
  return response.json();
};

export const getPoll = async (pollId) => {
  const token = getToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(`${API_URL}/polls/${pollId}`, { headers });
  if (!response.ok) throw new Error("Опрос не найден");
  return response.json();
};

export const getActivePollWidget = async () => {
  const token = getToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(`${API_URL}/polls/active-widget`, { headers });
  if (!response.ok) throw new Error("Ошибка виджета опроса");
  return response.json();
};

export const votePoll = async (pollId, optionId) => {
  const token = getToken();
  if (!token) throw new Error("Войдите, чтобы проголосовать");
  const response = await fetch(`${API_URL}/polls/${pollId}/vote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ option_id: optionId }),
  });
  if (!response.ok) {
    const t = await response.text();
    let msg = t;
    try {
      const j = JSON.parse(t);
      if (j.error) msg = j.error;
    } catch {
      /* */
    }
    throw new Error(msg || "Не удалось проголосовать");
  }
  return response.json();
};

export const testRegister = async () => {
  const testData = {
    email: "test@example.com",
    password: "test123"
  };
  
  console.log("Тестовые данные:", testData);
  
  const response = await fetch(`${API_URL}/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(testData),
  });
  
  console.log("Тестовый статус:", response.status);
  console.log("Тестовые заголовки:", response.headers);
  
  const text = await response.text();
  console.log("Тестовый ответ:", text);
  
  return { status: response.status, text };
};