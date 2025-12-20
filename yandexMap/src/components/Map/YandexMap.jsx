import React, { useState, useEffect } from "react";
import { YMaps, Map, Placemark } from "@pbe/react-yandex-maps";
import MapHeader from "./MapHeader.jsx";
import "./YandexMap.css";

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

const YandexMap = () => {
  const [placemarks, setPlacemarks] = useState([]);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [newPointText, setNewPointText] = useState("");
  const [newPointImage, setNewPointImage] = useState(null);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [uploading, setUploading] = useState(false);

  const mapDefault = {
    center: [55.751244, 37.618423],
    zoom: 11,
  };

  useEffect(() => {
    loadMarkers();
  }, []);

  const loadMarkers = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:8080/api/markers");
      if (!response.ok) throw new Error("Failed to load markers");
      const data = await response.json();
      setPlacemarks(data.markers || data || []);
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
    setShowAddPanel(true);
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

      if (!response.ok) {
        throw new Error("Failed to upload image");
      }

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
      setSelectedCoords(null);
      
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

    const reader = new FileReader();
    reader.onload = () => {
      setNewPointImage(reader.result);
    };
    reader.onerror = () => {
      alert("Ошибка чтения файла");
    };
    reader.readAsDataURL(file);
  };

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
            {placemarks.map((p) => (
              <Placemark
                key={p.id}
                geometry={[p.latitude, p.longitude]}
                properties={{
                  balloonContent: `
                    <div style="max-width:250px">
                      <strong>Проблема:</strong><br/>
                      ${p.text || ""}
                      ${
                        p.image_url
                          ? `<br/>
                             <img src="http://localhost:8080${p.image_url}"
                                  style="width:100%;border-radius:8px;margin-top:10px;" />`
                          : ""
                      }
                      <br/>
                      <small>Автор: ${p.user_email || "—"}</small><br/>
                      <small>${new Date(p.created_at).toLocaleDateString()}</small>
                    </div>
                  `,
                  hintContent: p.text || "Метка",
                }}
                options={{
                  preset: getColorByUser(p.user_id),
                  openBalloonOnClick: true,
                }}
                onClick={() => handleMarkerClick(p)}
              />
            ))}
          </Map>
        </YMaps>
      </div>

      
      {selectedMarker && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>
              ×
            </button>
            
            <div className="modal-header">
              <h2>Детали проблемы</h2>
              <div className="user-info">
                <span className="user-email">
                  👤 {selectedMarker.user_email || "Анонимный пользователь"}
                </span>
                <span className="problem-date">
                  📅 {new Date(selectedMarker.created_at).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>

            <div className="modal-body">
              <div className="problem-description">
                <h3>Описание:</h3>
                <p>{selectedMarker.text || "Без описания"}</p>
              </div>

              {selectedMarker.image_url && (
                <div className="problem-image">
                  <h3>Фотография:</h3>
                  <img 
                    src={`http://localhost:8080${selectedMarker.image_url}`}
                    alt="Фото проблемы"
                  />
                </div>
              )}

              <div className="problem-coordinates">
                <h3>Координаты:</h3>
                <p>
                  Широта: {selectedMarker.latitude?.toFixed(6) || "—"}<br/>
                  Долгота: {selectedMarker.longitude?.toFixed(6) || "—"}
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-close-modal" onClick={closeModal}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddPanel && (
        <div className="add-panel">
          <h2>Добавление проблемы</h2>

          <textarea
            placeholder="Опишите проблему..."
            value={newPointText}
            onChange={(e) => setNewPointText(e.target.value)}
            rows={4}
          />

          <div className="file-upload">
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleImageUpload}
              id="image-upload"
            />
            <label htmlFor="image-upload" className="upload-label">
              📷 Добавить фото (макс. 5MB)
            </label>
          </div>

          {newPointImage && (
            <div className="image-preview">
              <img
                src={newPointImage}
                alt="Предпросмотр"
              />
              <button 
                className="remove-image"
                onClick={() => setNewPointImage(null)}
              >
                ✕ Удалить фото
              </button>
            </div>
          )}

          <div className="panel-buttons">
            <button 
              className="btn-cancel" 
              onClick={() => setShowAddPanel(false)}
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