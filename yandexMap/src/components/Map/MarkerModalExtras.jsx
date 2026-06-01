import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_ORIGIN } from "../../config.js";
import {
  getMarkerTimeline,
  getFavoriteStatus,
  addFavorite,
  removeFavorite,
  patchMarkerMeta,
  uploadImage,
} from "../../services/api.js";
import { showToast } from "../ToastHost.jsx";
import { STATUS_LABELS } from "../../utils/slaLabels.js";
import "./MarkerModalExtras.css";

function fieldLabel(name) {
  const map = {
    status: "Статус",
    text: "Описание",
    image_after_url: "Фото «после»",
    address_text: "Адрес",
  };
  return map[name] || name;
}

export function MarkerModalToolbar({ marker, user, onShare }) {
  const [favorited, setFavorited] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  useEffect(() => {
    if (!user || !marker?.id) {
      setFavorited(false);
      return;
    }
    getFavoriteStatus(marker.id)
      .then((d) => setFavorited(!!d.favorited))
      .catch(() => setFavorited(false));
  }, [marker?.id, user]);

  const toggleFavorite = async () => {
    if (!user || !marker?.id) return;
    setFavBusy(true);
    try {
      if (favorited) {
        await removeFavorite(marker.id);
        setFavorited(false);
        showToast("Убрано из избранного", "info");
      } else {
        await addFavorite(marker.id);
        setFavorited(true);
        showToast("Добавлено в избранное", "success");
      }
    } catch (e) {
      showToast(e.message || "Ошибка", "error");
    } finally {
      setFavBusy(false);
    }
  };

  return (
    <div className="modal-actions-bar">
      <div className="modal-actions-bar__buttons">
        {onShare ? (
          <button type="button" className="modal-action-btn" onClick={onShare}>
            Поделиться
          </button>
        ) : null}
        {user ? (
          <button
            type="button"
            className={`modal-action-btn${favorited ? " modal-action-btn--on" : ""}`}
            disabled={favBusy}
            onClick={toggleFavorite}
          >
            {favorited ? "В избранном" : "В избранное"}
          </button>
        ) : null}
        {marker.user_id ? (
          <Link to={`/user/${marker.user_id}`} className="modal-action-btn modal-action-btn--link">
            Автор
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function MarkerTimelineFull({ markerId }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!markerId) return;
    setLoading(true);
    getMarkerTimeline(markerId)
      .then((d) => setList(d.timeline || []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [markerId]);

  if (loading) return <p className="modal-reviews-muted">Загрузка истории…</p>;
  if (!list.length) return <p className="modal-reviews-muted">Нет записей</p>;

  return (
    <ul className="modal-timeline">
      {list.map((e) => (
        <li key={`${e.kind}-${e.id}`} className="modal-timeline-item">
          <time className="modal-timeline-time">
            {new Date(e.created_at).toLocaleString("ru-RU")}
          </time>
          <div className="modal-timeline-body">
            {e.kind === "status" ? (
              <>
                <span className="modal-timeline-badge">Статус</span>
                {e.old_status ? (
                  <span>
                    {STATUS_LABELS[e.old_status] || e.old_status} →{" "}
                  </span>
                ) : null}
                <strong>{STATUS_LABELS[e.new_status] || e.new_status}</strong>
                {e.note ? <p className="modal-history-note">{e.note}</p> : null}
              </>
            ) : (
              <>
                <span className="modal-timeline-badge">{fieldLabel(e.field_name)}</span>
                <span className="modal-timeline-change">
                  {e.old_value || "—"} → {e.new_value || "—"}
                </span>
              </>
            )}
            {e.actor_email ? (
              <span className="modal-history-actor"> {e.actor_email}</span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MarkerBeforeAfter({ marker, user, onUpdated }) {
  const [pos, setPos] = useState(50);
  const [uploading, setUploading] = useState(false);
  const before = marker.image_url ? `${API_ORIGIN}${marker.image_url}` : null;
  const after = marker.image_after_url
    ? `${API_ORIGIN}${marker.image_after_url}`
    : null;
  const isResolved = marker.status === "resolved";
  const canUpload =
    user &&
    isResolved &&
    (marker.user_id === user.id || user.is_moderator || user.is_admin);

  const handleAfterUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const up = await uploadImage(file);
      const url = up.image_url || up.url;
      await patchMarkerMeta(marker.id, { image_after_url: url });
      showToast("Фото «после» загружено", "success");
      onUpdated?.({ ...marker, image_after_url: url });
    } catch (err) {
      showToast(err.message || "Ошибка загрузки", "error");
    } finally {
      setUploading(false);
    }
  };

  if (!before && !after) {
    if (!canUpload) return null;
    return (
      <section className="modal-section">
        <h3 className="modal-section-title">До / после</h3>
        <p className="modal-reviews-muted">Добавьте фото результата после решения проблемы.</p>
        <label className="modal-after-upload">
          <input type="file" accept="image/*" disabled={uploading} onChange={handleAfterUpload} />
          {uploading ? "Загрузка…" : "Загрузить фото «после»"}
        </label>
      </section>
    );
  }

  if (!after) {
    if (!canUpload) return null;
    return (
      <section className="modal-section">
        <h3 className="modal-section-title">До / после</h3>
        <p className="modal-reviews-muted">Добавьте фото результата после решения проблемы.</p>
        <label className="modal-after-upload">
          <input type="file" accept="image/*" disabled={uploading} onChange={handleAfterUpload} />
          {uploading ? "Загрузка…" : "Загрузить фото «после»"}
        </label>
      </section>
    );
  }

  return (
    <section className="modal-section modal-before-after">
      <h3 className="modal-section-title">До / после</h3>
      <div
        className="before-after-slider"
        style={{ "--pos": `${pos}%` }}
      >
        <img src={before || after} alt="До" className="before-after-img before-after-img--before" />
        <div className="before-after-clip">
          <img src={after} alt="После" className="before-after-img before-after-img--after" />
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          className="before-after-range"
          aria-label="Сравнение до и после"
          onChange={(ev) => setPos(Number(ev.target.value))}
        />
      </div>
      <div className="before-after-labels">
        <span>До</span>
        <span>После</span>
      </div>
      {canUpload ? (
        <label className="modal-after-upload">
          <input type="file" accept="image/*" disabled={uploading} onChange={handleAfterUpload} />
          Заменить фото «после»
        </label>
      ) : null}
    </section>
  );
}
