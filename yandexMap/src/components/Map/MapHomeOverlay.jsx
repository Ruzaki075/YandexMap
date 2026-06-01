import React, { useContext, useEffect, useState } from "react";
import { Link, useHistory } from "react-router-dom";
import { AuthContext } from "../Auth/AuthContext.jsx";
import { useUnreadNotifications } from "../../hooks/useUnreadNotifications.js";
import { resolveAvatarUrl } from "../../utils/avatarUrl.js";
import { userAvatarLetter } from "../../utils/userDisplay.js";
import "./MapHomeOverlay.css";

const DOMAIN_CHIP_EMOJI = {
  roads: "🛣️",
  transit: "🚌",
  pedestrian: "🚶",
  utilities: "⚡",
  social: "🌳",
};

function chipLabel(domain) {
  const em = DOMAIN_CHIP_EMOJI[domain.key] || "•";
  const short =
    domain.key === "roads"
      ? "Дороги"
      : domain.key === "transit"
        ? "Транспорт"
        : domain.key === "pedestrian"
          ? "Пешеходы"
          : domain.key === "utilities"
            ? "ЖКХ"
            : domain.key === "social"
              ? "Соцсфера"
              : domain.label_ru;
  return `${em} ${short}`;
}

/**
 * Шапка, фильтры и мини-статистика поверх карты (стиль «Активный гражданин»).
 */
export default function MapHomeOverlay({
  mapSearch,
  setMapSearch,
  searchLoading,
  mapDomainFilter,
  setMapDomainFilter,
  taxonomy,
  showHeatmap,
  setShowHeatmap,
  mapLayer,
  setMapLayer,
  mapStats,
  theme,
  toggleTheme,
  statsCollapsed,
  setStatsCollapsed,
}) {
  const { user } = useContext(AuthContext);
  const history = useHistory();
  const { unreadCount } = useUnreadNotifications();
  const [headerCompact, setHeaderCompact] = useState(false);

  useEffect(() => {
    const onScroll = () => setHeaderCompact(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const total = mapStats?.total ?? mapStats?.all ?? 0;
  const resolved = mapStats?.resolved ?? 0;
  const resolvedPct = total > 0 ? Math.round((resolved / total) * 100) : 0;

  return (
    <div className="map-home-overlay" aria-hidden={false}>
      <header
        className={`map-home-header${headerCompact ? " map-home-header--compact" : ""}`}
      >
        <Link to="/" className="map-home-brand">
          <span className="map-home-brand-icon" aria-hidden="true">
            📍
          </span>
          {!headerCompact ? (
            <span className="map-home-brand-text">ГородОК</span>
          ) : null}
        </Link>

        <div className="map-home-search-wrap">
          <span className="map-home-search-icon" aria-hidden="true">
            🔍
          </span>
          <input
            type="search"
            className="map-home-search"
            placeholder="Поиск обращений…"
            value={mapSearch}
            onChange={(e) => setMapSearch(e.target.value)}
            aria-busy={searchLoading}
          />
        </div>

        <div className="map-home-header-actions">
          <button
            type="button"
            className="map-home-icon-btn"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
            title="Тема"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          {user ? (
            <Link
              to="/notifications"
              className="map-home-icon-btn map-home-icon-btn--badge"
              aria-label="Уведомления"
            >
              🔔
              {unreadCount > 0 ? (
                <span className="map-home-badge">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </Link>
          ) : null}

          {user ? (
            <Link to="/profile" className="map-home-avatar" aria-label="Профиль">
              {resolveAvatarUrl(user.avatar_url) ? (
                <img src={resolveAvatarUrl(user.avatar_url)} alt="" />
              ) : (
                <span>{userAvatarLetter(user, "Г")}</span>
              )}
            </Link>
          ) : (
            <button
              type="button"
              className="map-home-login-btn"
              onClick={() => history.push("/login")}
            >
              Войти
            </button>
          )}
        </div>
      </header>

      <div className="map-home-filters-row">
        <div className="map-home-chips" role="tablist" aria-label="Категории">
          <button
            type="button"
            role="tab"
            aria-selected={!mapDomainFilter}
            className={`map-home-chip${!mapDomainFilter ? " is-active" : ""}`}
            onClick={() => setMapDomainFilter("")}
          >
            Все
          </button>
          {(taxonomy?.domains || []).map((d) => (
            <button
              key={d.key}
              type="button"
              role="tab"
              aria-selected={mapDomainFilter === d.key}
              className={`map-home-chip${
                mapDomainFilter === d.key ? " is-active" : ""
              }`}
              onClick={() =>
                setMapDomainFilter((k) => (k === d.key ? "" : d.key))
              }
            >
              {chipLabel(d)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`map-home-layers-btn${showHeatmap ? " is-active" : ""}`}
          onClick={() => {
            setShowHeatmap((v) => !v);
            if (!showHeatmap) setMapLayer("active");
          }}
          aria-pressed={showHeatmap}
        >
          🗺️ Слои
        </button>
      </div>

      <div className="map-home-layer-tabs" role="tablist" aria-label="Статус на карте">
        {[
          { key: "active", label: "Активные" },
          { key: "resolved", label: "Решённые" },
          { key: "all", label: "Все" },
        ].map((opt) => (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={mapLayer === opt.key && !showHeatmap}
            className={`map-home-layer-tab${
              mapLayer === opt.key && !showHeatmap ? " is-active" : ""
            }`}
            onClick={() => {
              setShowHeatmap(false);
              setMapLayer(opt.key);
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {mapStats ? (
        <div
          className={`map-home-stats${statsCollapsed ? " map-home-stats--mini" : ""}`}
        >
          <button
            type="button"
            className="map-home-stats-toggle"
            onClick={() => setStatsCollapsed((v) => !v)}
            aria-expanded={!statsCollapsed}
          >
            {statsCollapsed ? "📊" : null}
          </button>
          {!statsCollapsed ? (
            <Link to="/stats" className="map-home-stats-body">
              <span>📊 Всего: {total}</span>
              <span>
                ✅ Решено: {resolved} ({resolvedPct}%)
              </span>
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
