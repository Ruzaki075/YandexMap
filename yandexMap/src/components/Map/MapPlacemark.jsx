import React from "react";
import { Placemark } from "@pbe/react-yandex-maps";
import {
  getMarkerPreset,
  getMarkerIconContent,
} from "../../utils/markerColors.js";

/**
 * Обычная метка Яндекс.Карт (пресет islands#): цвет по направлению, статус — контур/галочка.
 */
export default function MapPlacemark({ marker, taxonomy, onMarkerClick }) {
  const text = marker.text || "Обращение";
  const likes = Number(marker.support_count) || 0;
  const textShort = text.length > 52 ? `${text.slice(0, 52)}…` : text;
  const hint =
    likes > 0
      ? `♥ ${likes} · ${textShort}`
      : textShort;

  return (
    <Placemark
      geometry={[marker.latitude, marker.longitude]}
      properties={{
        hintContent: hint,
        balloonContent: "",
        iconContent: getMarkerIconContent(marker.status),
      }}
      options={{
        preset: getMarkerPreset(
          marker.domain_key,
          taxonomy,
          marker.status
        ),
        openBalloonOnClick: false,
      }}
      onClick={() => onMarkerClick(marker)}
    />
  );
}
