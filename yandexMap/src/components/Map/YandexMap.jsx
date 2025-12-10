import React, { useState, useEffect } from "react";
import { YMaps, Map, Placemark } from "@pbe/react-yandex-maps";
import MapHeader from "./MapHeader.jsx";
import { getMarkers, createMarker, uploadImage } from "../../services/api";
import "./YandexMap.css";

const YandexMap = () => {
  const [placemarks, setPlacemarks] = useState([]);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [newPointText, setNewPointText] = useState("");
  const [newPointImage, setNewPointImage] = useState(null);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [loading, setLoading] = useState(true);

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
      const data = await getMarkers();
      setPlacemarks(data.markers || []);
    } catch (error) {
      console.error("Error loading markers:", error);
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

  const addPoint = async () => {
    if (!newPointText.trim()) {
      alert("Введите описание проблемы");
      return;
    }

    try {
      let imageUrl = null;
      
      if (newPointImage && newPointImage.startsWith('data:')) {
        const response = await fetch(newPointImage);
        const blob = await response.blob();
        const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
        
        const uploadResult = await uploadImage(file);
        imageUrl = uploadResult.image_url;
      }

      await createMarker({
        text: newPointText,
        latitude: selectedCoords[0],
        longitude: selectedCoords[1],
        image_url: imageUrl,
      });

      await loadMarkers();
      
      setShowAddPanel(false);
      setNewPointText("");
      setSelectedCoords(null);
      setNewPointImage(null);
      
      alert("Маркер успешно добавлен!");
      
    } catch (error) {
      console.error("Error adding point:", error);
      alert("Ошибка при добавлении маркера: " + error.message);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setNewPointImage(reader.result);
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
                    <div style="max-width:230px">
                      <strong>Проблема:</strong><br>${p.text}
                      ${
                        p.image_url
                          ? `<br><img src="http://localhost:8080${p.image_url}" style="width:200px;border-radius:8px;margin-top:10px;" />`
                          : ""
                      }
                      <br><small>${new Date(p.created_at).toLocaleDateString()}</small>
                    </div>
                  `,
                  hintContent: p.text,
                }}
                options={{ preset: "islands#redIcon", openBalloonOnClick: true }}
              />
            ))}
          </Map>
        </YMaps>
      </div>

      {showAddPanel && (
        <div className="add-panel">
          <h2>Добавление проблемы</h2>

          <textarea
            placeholder="Опишите проблему..."
            value={newPointText}
            onChange={(e) => setNewPointText(e.target.value)}
          />

          <input type="file" accept="image/*" onChange={handleImageUpload} />

          {newPointImage && (
            <img
              src={newPointImage}
              alt="preview"
              style={{
                width: "100%",
                marginTop: "10px",
                borderRadius: "8px",
              }}
            />
          )}

          <div className="panel-buttons">
            <button className="btn-cancel" onClick={() => setShowAddPanel(false)}>
              Отмена
            </button>
            <button className="btn-add" onClick={addPoint}>
              Добавить
            </button>
          </div>
        </div>
      )}
      
      {loading && (
        <div className="loading-overlay">
          <div>Загрузка маркеров...</div>
        </div>
      )}
    </div>
  );
};

export default YandexMap;