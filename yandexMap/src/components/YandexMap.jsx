import React, { useState, useEffect } from "react";
import { YMaps, Map, Placemark } from "@pbe/react-yandex-maps";
import "./YandexMap.css";

const YandexMap = () => {
  const [placemarks, setPlacemarks] = useState([]);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  const defaultState = {
    center: [51.768205, 55.097000], // Москва
    zoom: 12,
  };

  const handleMapClick = (e) => {
    const coords = e.get("coords");
    const text = prompt("Опиши проблему на этом месте:");
    if (!text) return;
    setPlacemarks([...placemarks, { coords, text }]);
  };

  const handleMouseMove = (e) => {
    setCursorPos({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="page-wrapper">
      {}
      <div
        className="cursor-light"
        style={{ left: cursorPos.x, top: cursorPos.y }}
      />

      {/* Крутой хедер */}
      <header className="header">
        <h1 className="header-title">Карта Проблем</h1>
      </header>

      <div className="map-wrapper">
        <YMaps query={{ apikey: "e99fcd77-5ec6-4928-85ff-47ddb2f50012" }}>
          <Map
            defaultState={defaultState}
            width="100%"
            height="100%"
            onClick={handleMapClick}
            modules={["control.ZoomControl", "control.FullscreenControl"]}
            options={{ suppressMapOpenBlock: true }}
          >
            {placemarks.map((mark, i) => (
              <Placemark
                key={i}
                geometry={mark.coords}
                properties={{
                  balloonContent: `<strong>Проблема:</strong><br/>${mark.text}`,
                  hintContent: mark.text,
                }}
                options={{ preset: "islands#redDotIcon" }}
              />
            ))}
          </Map>
        </YMaps>
      </div>
    </div>
  );
};

export default YandexMap;