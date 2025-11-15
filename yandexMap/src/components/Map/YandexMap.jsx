import React, { useState } from "react";
import { YMaps, Map, Placemark } from "@pbe/react-yandex-maps";
import MapHeader from "./MapHeader.jsx";
import "./YandexMap.css";

const YandexMap = () => {
  const [placemarks, setPlacemarks] = useState([]);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [newPointText, setNewPointText] = useState("");
  const [selectedCoords, setSelectedCoords] = useState(null);

  const mapDefault = {
    center: [55.751244, 37.618423],
    zoom: 11,
  };

  const handleMapClick = (event) => {
    const coords = event.get("coords");
    setSelectedCoords(coords);
    setShowAddPanel(true);
  };

  const addPoint = () => {
    if (!newPointText.trim()) return;

    setPlacemarks([
      ...placemarks,
      {
        coords: selectedCoords,
        text: newPointText,
      },
    ]);

    setShowAddPanel(false);
    setNewPointText("");
    setSelectedCoords(null);
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
                  balloonContent: `<strong>Проблема:</strong><br>${p.text}`,
                  hintContent: p.text,
                }}
                options={{ preset: "islands#redIcon" }}
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
