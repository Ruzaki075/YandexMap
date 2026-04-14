const API_URL = "http://localhost:8080/api";

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

export const getMarkers = async () => {
  try {
    console.log("Запрашиваем маркеры...");
    
    const response = await fetch(`${API_URL}/markers`);
    
    console.log("Статус ответа маркеров:", response.status);
    console.log("Заголовки ответа маркеров:", response.headers);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ошибка при загрузке маркеров: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    console.log("Получены маркеры:", data);
    return data;
  } catch (error) {
    console.error("Ошибка в getMarkers:", error);
    throw error;
  }
};

/** Смена статуса метки (модератор): pending | approved | rejected | resolved */
export const patchMarkerStatus = async (markerId, status) => {
  const token = getToken();
  if (!token) {
    throw new Error("Требуется авторизация модератора.");
  }
  const response = await fetch(`${API_URL}/markers/${markerId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
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