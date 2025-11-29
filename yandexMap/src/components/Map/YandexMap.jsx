import React, { useState } from "react";
import { YMaps, Map, Placemark } from "@pbe/react-yandex-maps";
import MapHeader from "./MapHeader.jsx";
import "./YandexMap.css";

const YandexMap = () => {
  const [placemarks, setPlacemarks] = useState([]);

  // панель добавления
  const [showAddPanel, setShowAddPanel] = useState(false);

  // текст проблемы
  const [newPointText, setNewPointText] = useState("");

  // фото
  const [newPointImage, setNewPointImage] = useState(null);

  // координаты выбранного места
  const [selectedCoords, setSelectedCoords] = useState(null);

  // проверка авторизации
  const isAuth = !!localStorage.getItem("token");

  const mapDefault = {
    center: [55.751244, 37.618423],
    zoom: 11,
  };

  // клик по карте
  const handleMapClick = (event) => {
    if (!isAuth) {
      alert("Чтобы добавить проблему — войдите в аккаунт.");
      return;
    }

    const coords = event.get("coords");
    setSelectedCoords(coords);
    setShowAddPanel(true);
  };

  // кнопка "Добавить"
  const addPoint = () => {
    if (!newPointText.trim()) return;

    const newPlacemark = {
      coords: selectedCoords,
      text: newPointText,
      image: newPointImage, // картинка
    };

    setPlacemarks([...placemarks, newPlacemark]);

    // очистка
    setShowAddPanel(false);
    setNewPointText("");
    setSelectedCoords(null);
    setNewPointImage(null);
  };

  // загрузка фото
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
            {placemarks.map((p, index) => (
              <Placemark
                key={index}
                geometry={p.coords}
                properties={{
                  balloonContent: `
                    <div style="max-width:230px">
                      <strong>Проблема:</strong><br>${p.text}
                      ${
                        p.image
                          ? `<br><img src="${p.image}" style="width:200px;border-radius:8px;margin-top:10px;" />`
                          : ""
                      }
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

      {/* Панель добавления */}
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

    </div>
  );
};

export default YandexMap;
