const API_URL = 'http://localhost:8080/api';

// Регистрация
export const register = async (email, password) => {
    const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
    }
    
    return response.json();
};

// Логин
export const login = async (email, password) => {
    const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
    });
    
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Login failed');
    }
    
    const data = await res.json();
    localStorage.setItem("user", JSON.stringify(data.user));
    return data;
};

// Получить маркеры
export const getMarkers = async () => {
    const response = await fetch(`${API_URL}/markers`);
    
    if (!response.ok) {
        throw new Error('Failed to fetch markers');
    }
    
    return response.json();
};

// Создать маркер
export const createMarker = async (markerData) => {
    const response = await fetch(`${API_URL}/markers`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(markerData),
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create marker');
    }
    
    return response.json();
};

// Загрузить изображение
export const uploadImage = async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    
    const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload image');
    }
    
    return response.json();
};

// Получить профиль
export const getProfile = async () => {
    const response = await fetch(`${API_URL}/profile`);
    
    if (!response.ok) {
        throw new Error('Failed to fetch profile');
    }
    
    return response.json();
};

// Выход
export const logout = async () => {
    try {
        await fetch(`${API_URL}/logout`, { method: 'POST' });
    } catch (error) {
        console.error('Logout error:', error);
    }
    localStorage.removeItem("user");
};