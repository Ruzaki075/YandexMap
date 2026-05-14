import React, { useState, useEffect, useCallback } from "react";
import { useHistory, Link } from "react-router-dom";
import MapHeader from "../Map/MapHeader.jsx";
import {
  IconRowPending,
  IconRowRejected,
  IconRowOk,
} from "../Moderation/ModerationIcons.jsx";
import { getMyMarkers } from "../../services/api.js";
import "./Profile.css";

/** Одобрено модератором или отмечено решённым — в профиле считаем «обработано». */
function isResolvedLike(status) {
  const s = status || "pending";
  return s === "resolved" || s === "approved";
}

function statusLabel(status) {
  const s = status || "pending";
  if (s === "pending") return "На проверке";
  if (s === "approved") return "Одобрено";
  if (s === "rejected") return "Отклонено";
  if (s === "resolved") return "Решено";
  return s;
}

const Profile = () => {
  const history = useHistory();
  const [user, setUser] = useState(null);
  const [userMarkers, setUserMarkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalMarkers: 0,
    pendingMarkers: 0,
    resolvedMarkers: 0
  });

  const loadUserData = useCallback(async () => {
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) {
        history.push("/login");
        return;
      }

      const userData = JSON.parse(userStr);
      setUser(userData);

      const data = await getMyMarkers();
      if (data) {
        const markers = data.markers || [];
        setUserMarkers(markers);

        const total = markers.length;
        const pending = markers.filter((m) => (m.status || "pending") === "pending").length;
        const resolved = markers.filter((m) => isResolvedLike(m.status)).length;

        setStats({
          totalMarkers: total,
          pendingMarkers: pending,
          resolvedMarkers: resolved,
        });
      }
    } catch (error) {
      console.error("Ошибка загрузки данных:", error);
    } finally {
      setLoading(false);
    }
  }, [history]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    history.push("/login");
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const handleViewMarker = (markerId) => {
    history.push(`/?marker=${markerId}`);
  };

  if (loading) {
    return (
      <>
        <MapHeader />
        <div className="profile-page page-aurora">
          <div className="profile-loading">
            <div className="loading-spinner"></div>
            <p>Загрузка профиля...</p>
          </div>
        </div>
      </>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <MapHeader />

      <div className="profile-page page-aurora">
        <div className="profile-container">
          <div className="profile-header">
            <div className="profile-avatar">
              <div className="avatar-circle">
                {user.email.charAt(0).toUpperCase()}
              </div>
              <div className="online-dot"></div>
            </div>
            
            <div className="profile-info">
              <h1 className="profile-name">{user.email}</h1>
              <p className="profile-role">
                {Boolean(user.is_admin)
                  ? "Администратор"
                  : Boolean(user.is_moderator)
                    ? "Модератор"
                    : "Активный пользователь"}
              </p>
              <p className="profile-join-date">
                Зарегистрирован {formatDate(user.created_at || new Date())}
              </p>
            </div>

            <button className="logout-btn" onClick={handleLogout}>
              <span>Выйти</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon total">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
              </div>
              <div className="stat-content">
                <h3>{stats.totalMarkers}</h3>
                <p>Всего проблем</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon pending">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
              <div className="stat-content">
                <h3>{stats.pendingMarkers}</h3>
                <p>Ожидают решения</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon resolved">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <div className="stat-content">
                <h3>{stats.resolvedMarkers}</h3>
                <p>Принято / решено</p>
                <p className="stat-hint">вкл. одобренные модератором</p>
              </div>
            </div>
          </div>

          <div className="recent-marks">
            <div className="section-header">
              <h2>Ваши последние метки</h2>
              <Link to="/" className="view-all">Все метки →</Link>
            </div>

            {userMarkers.length === 0 ? (
              <div className="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <p>У вас пока нет добавленных проблем</p>
                <Link to="/" className="add-first-btn">Добавить первую проблему</Link>
              </div>
            ) : (
              <div className="marks-list">
                {userMarkers.slice(0, 5).map(marker => {
                  const st = marker.status || "pending";
                  const icon =
                    st === "pending" ? (
                      <IconRowPending size={22} />
                    ) : st === "rejected" ? (
                      <IconRowRejected size={22} />
                    ) : (
                      <IconRowOk size={22} />
                    );
                  return (
                  <div key={marker.id} className="mark-item" data-status={st}>
                    <div className="mark-status" data-status={st}>
                      {icon}
                    </div>
                    <div className="mark-content">
                      <h4>{marker.text.substring(0, 60)}{marker.text.length > 60 ? '...' : ''}</h4>
                      <span className="mark-status-pill">{statusLabel(st)}</span>
                      <div className="mark-meta">
                        <span className="mark-date">
                           {formatDate(marker.created_at)}
                        </span>
                        <span className="mark-coords">
                          📍 {marker.latitude?.toFixed(4)}, {marker.longitude?.toFixed(4)}
                        </span>
                      </div>
                    </div>
                    <div className="mark-actions">
                      <button 
                        className="view-btn"
                        onClick={() => handleViewMarker(marker.id)}
                      >
                        Просмотр
                      </button>
                    </div>
                  </div>
                );
                })}
              </div>
            )}
          </div>

          <div className="profile-actions">
            <Link to="/" className="action-btn primary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M12 5v14M5 12h14"></path>
              </svg>
              Добавить новую проблему
            </Link>
            <button className="action-btn secondary" onClick={() => history.push("/")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
                <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
              </svg>
              На карту
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Profile;