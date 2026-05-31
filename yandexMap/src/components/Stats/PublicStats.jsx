import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import MapHeader from "../Map/MapHeader.jsx";
import { getMapStats } from "../../services/api.js";
import "../Profile/Profile.css";
import "./PublicStats.css";

export default function PublicStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMapStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <MapHeader />
      <div className="profile-page page-aurora">
        <div className="profile-container stats-page">
          <div className="section-header">
            <h2>Статистика карты</h2>
            <Link to="/" className="view-all">
              На карту →
            </Link>
          </div>
          {loading ? (
            <p className="admin-meta-muted">Загрузка…</p>
          ) : !stats ? (
            <div className="empty-state mod-empty">
              <p>Не удалось загрузить данные.</p>
              <Link to="/">Вернуться на карту</Link>
            </div>
          ) : (
            <div className="stats-grid">
              <div className="stats-card">
                <span className="stats-card__num">{stats.total ?? 0}</span>
                <span className="stats-card__label">Всего на карте</span>
              </div>
              <div className="stats-card stats-card--active">
                <span className="stats-card__num">{stats.active ?? 0}</span>
                <span className="stats-card__label">Активные</span>
              </div>
              <div className="stats-card stats-card--resolved">
                <span className="stats-card__num">{stats.resolved ?? 0}</span>
                <span className="stats-card__label">Решённые</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
