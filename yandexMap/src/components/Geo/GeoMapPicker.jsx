import React, { useState } from "react";
import { YMaps, Map, Placemark } from "@pbe/react-yandex-maps";
import "./GeoMapPicker.css";

const DEFAULT = { center: [55.751244, 37.618423], zoom: 12 };

export default function GeoMapPicker({ initial, onPick, onClose }) {
  const [coords, setCoords] = useState(
    initial?.length === 2 ? initial : DEFAULT.center
  );

  return (
    <div className="geo-picker-overlay" onClick={onClose}>
      <div className="geo-picker-panel" onClick={(e) => e.stopPropagation()}>
        <h3>Выберите точку на карте</h3>
        <div className="geo-picker-map">
          <YMaps
            query={{
              apikey: "e99fcd77-5ec6-4928-85ff-47ddb2f50012",
              load: "package.full",
            }}
          >
            <Map
              defaultState={{ center: coords, zoom: DEFAULT.zoom }}
              width="100%"
              height="100%"
              onClick={(e) => setCoords(e.get("coords"))}
            >
              <Placemark geometry={coords} />
            </Map>
          </YMaps>
        </div>
        <p className="geo-picker-coords">
          {coords[0].toFixed(5)}, {coords[1].toFixed(5)}
        </p>
        <div className="geo-picker-actions">
          <button type="button" className="action-btn secondary" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="action-btn primary"
            onClick={() => onPick(coords)}
          >
            Выбрать
          </button>
        </div>
      </div>
    </div>
  );
}
