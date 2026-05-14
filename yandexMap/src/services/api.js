import { API_URL } from "../config.js";

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
    console.error("Токен не найден в localStorage");
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

/** Смена статуса метки (модератор): pending | approved | rejected | resolved; moderator_note — опционально */
export const patchMarkerStatus = async (markerId, status, moderatorNote) => {
  const token = getToken();
  if (!token) {
    throw new Error("Требуется авторизация модератора.");
  }
  const body = { status };
  if (moderatorNote != null && String(moderatorNote).trim() !== "") {
    body.moderator_note = String(moderatorNote).trim();
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
  try {
    const token = getToken();
    
    if (!token) {
      throw new Error("Требуется авторизация. Пожалуйста, войдите в систему.");
    }

    console.log("Отправляем запрос создания маркера с токеном:", token.substring(0, 20) + "...");

    const response = await fetch(`${API_URL}/markers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(markerData),
    });

    console.log("Статус ответа создания маркера:", response.status);

    if (response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      throw new Error("Сессия истекла. Пожалуйста, войдите снова.");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ошибка при создании маркера: ${errorText}`);
    }

    return response.json();
  } catch (error) {
    console.error("Ошибка в createMarker:", error);
    throw error;
  }
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

    return response.json();
  } catch (error) {
    console.error("Ошибка в uploadImage:", error);
    throw error;
  }
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