import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listFavorites, removeFavorite } from "../../services/api.js";
import { showToast } from "../ToastHost.jsx";
import { STATUS_LABELS } from "../../utils/slaLabels.js";

export default function ProfileFavorites({ onViewMarker }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    listFavorites()
      .then((d) => setItems(d.favorites || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleRemove = async (markerId) => {
    try {
      await removeFavorite(markerId);
      showToast("Убрано из избранного", "info");
      load();
    } catch (e) {
      showToast(e.message || "Ошибка", "error");
    }
  };

  if (loading) return <p className="admin-meta-muted">Загрузка избранного…</p>;
  if (!items.length) {
    return (
      <div className="empty-state">
        <p>Нет сохранённых обращений.</p>
        <p className="admin-meta-muted">
          На карте откройте обращение и нажмите «В избранное».
        </p>
      </div>
    );
  }

  return (
    <div className="marks-list">
      {items.map(({ marker, favorited_at }) => (
        <div key={marker.id} className="mark-item" data-status={marker.status}>
          <div className="mark-content">
            <h4>
              {marker.text?.substring(0, 100)}
              {marker.text?.length > 100 ? "…" : ""}
            </h4>
            <span className="mark-status-pill">
              {STATUS_LABELS[marker.status] || marker.status}
            </span>
            <span className="mark-date">
              Сохранено {new Date(favorited_at).toLocaleDateString("ru-RU")}
            </span>
          </div>
          <div className="mark-actions">
            <button
              type="button"
              className="view-btn"
              onClick={() => onViewMarker(marker.id)}
            >
              Открыть
            </button>
            <button
              type="button"
              className="profile-delete-btn"
              onClick={() => handleRemove(marker.id)}
            >
              Убрать
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
