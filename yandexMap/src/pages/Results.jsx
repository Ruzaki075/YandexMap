import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  CategoryIcon,
  IconCheck,
  IconPin,
} from "../components/Icons.jsx";
import { API_ORIGIN } from "../config.js";
import { useCountUp } from "../hooks/useCountUp.js";
import { useInViewOnce } from "../hooks/useInViewOnce.js";
import { useTaxonomy } from "../hooks/useTaxonomy.js";
import {
  getLeaderboard,
  getMapStats,
  getMarkers,
} from "../services/api.js";
import { resolveAvatarUrl } from "../utils/avatarUrl.js";
import { findCategoryLabels } from "../utils/issueLabels.js";
import { compareMarkersByLikesDesc } from "../utils/mainPageUtils.js";
import { userAvatarLetter, userDisplayLabel } from "../utils/userDisplay.js";
import StatCounters from "./StatCounters.jsx";
import "./pages.css";
import "./Results.css";

const PAGE_SIZE = 12;

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function markerPhotoUrl(marker) {
  const path = marker.image_after_url || marker.image_url;
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API_ORIGIN}${path}`;
}

function hasPhoto(marker) {
  return !!(marker.image_url || marker.image_after_url);
}

function sortMarkersPhotoFirst(list) {
  return [...list].sort((a, b) => {
    const likeDiff = compareMarkersByLikesDesc(a, b);
    if (likeDiff !== 0) return likeDiff;
    const diff = Number(hasPhoto(b)) - Number(hasPhoto(a));
    if (diff !== 0) return diff;
    const da = new Date(a.resolved_at || a.updated_at || 0).getTime();
    const db = new Date(b.resolved_at || b.updated_at || 0).getTime();
    return db - da;
  });
}

function CategoryBar({ row }) {
  const [ref, inView] = useInViewOnce({ threshold: 0.2 });
  const pct = row.total > 0 ? Math.round((row.resolved / row.total) * 100) : 0;

  return (
    <div ref={ref} className="results-bar-row">
      <span className="results-bar-row__label">
        <CategoryIcon domainKey={row.key} size={18} />
        {row.label}
      </span>
      <div className="results-bar-track">
        <div
          className="results-bar-fill"
          style={{ width: inView ? `${pct}%` : "0%" }}
        />
      </div>
      <span className="results-bar-row__pct">
        {pct}% решено ({row.resolved})
      </span>
    </div>
  );
}

export default function Results() {
  const history = useHistory();
  const { taxonomy } = useTaxonomy();
  const [heroRef, heroInView] = useInViewOnce({ threshold: 0.3 });

  const [mapStats, setMapStats] = useState({
    total: 0,
    active: 0,
    resolved: 0,
    participants: 0,
  });
  const [resolvedMarkers, setResolvedMarkers] = useState([]);
  const [resolvedTotal, setResolvedTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingResolved, setLoadingResolved] = useState(true);
  const [leaders, setLeaders] = useState([]);
  const [allMarkers, setAllMarkers] = useState([]);
  const [topCategory, setTopCategory] = useState("—");
  const [topUser, setTopUser] = useState("—");

  const heroCount = useCountUp(mapStats.resolved, heroInView, 1500);

  const loadStats = useCallback(() => {
    getMapStats()
      .then((s) => {
        setMapStats((prev) => ({
          ...prev,
          total: s.total ?? 0,
          active: s.active ?? 0,
          resolved: s.resolved ?? 0,
        }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadStats();
    getLeaderboard()
      .then((d) => {
        const list = (d.leaders || []).slice(0, 10);
        setLeaders(list);
        if (list[0]) {
          setTopUser(
            userDisplayLabel(
              {
                display_name: list[0].display_name,
                email: list[0].email,
              },
              "Участник"
            )
          );
        }
      })
      .catch(() => setLeaders([]));

    getMarkers({ layer: "all" })
      .then((d) => {
        const markers = d.markers || [];
        setAllMarkers(markers);
        const users = new Set(
          markers.map((m) => m.user_id).filter((id) => id != null)
        );
        setMapStats((prev) => ({ ...prev, participants: users.size }));
      })
      .catch(() => {});
  }, [loadStats]);

  useEffect(() => {
    setLoadingResolved(true);
    getMarkers({ status: "resolved", page, page_size: PAGE_SIZE })
      .then((d) => {
        setResolvedTotal(d.total ?? 0);
        setResolvedMarkers(sortMarkersPhotoFirst(d.markers || []));
      })
      .catch(() => {
        setResolvedMarkers([]);
        setResolvedTotal(0);
      })
      .finally(() => setLoadingResolved(false));
  }, [page]);

  const categoryBars = useMemo(() => {
    const domains = taxonomy?.domains || [];
    const byKey = {};
    for (const d of domains) {
      byKey[d.key] = { key: d.key, label: d.label_ru, total: 0, resolved: 0 };
    }
    for (const m of allMarkers) {
      const key = m.domain_key || "other";
      if (!byKey[key]) {
        byKey[key] = { key, label: key, total: 0, resolved: 0 };
      }
      byKey[key].total += 1;
      if (m.status === "resolved") byKey[key].resolved += 1;
    }
    const rows = Object.values(byKey).filter((r) => r.total > 0);
    rows.sort((a, b) => {
      const pa = a.total ? a.resolved / a.total : 0;
      const pb = b.total ? b.resolved / b.total : 0;
      return pb - pa;
    });
    return rows;
  }, [allMarkers, taxonomy]);

  useEffect(() => {
    if (!taxonomy?.domains?.length || !allMarkers.length) return;
    const counts = {};
    for (const m of allMarkers) {
      if (m.status !== "resolved" || !m.domain_key) continue;
      counts[m.domain_key] = (counts[m.domain_key] || 0) + 1;
    }
    let bestKey = null;
    let bestN = 0;
    for (const [k, n] of Object.entries(counts)) {
      if (n > bestN) {
        bestN = n;
        bestKey = k;
      }
    }
    if (bestKey) {
      const labels = findCategoryLabels(taxonomy, bestKey);
      setTopCategory(labels?.domain || bestKey);
    }
  }, [allMarkers, taxonomy]);

  const totalPages = Math.max(1, Math.ceil(resolvedTotal / PAGE_SIZE));

  const openMarker = (id) => {
    history.push(`/?marker=${id}`);
  };

  const openCreate = () => {
    history.push("/?create=1");
  };

  const pageNumbers = useMemo(() => {
    const pages = [];
    const max = totalPages;
    if (max <= 7) {
      for (let i = 1; i <= max; i += 1) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (page > 3) pages.push("…");
    for (
      let i = Math.max(2, page - 1);
      i <= Math.min(max - 1, page + 1);
      i += 1
    ) {
      if (!pages.includes(i)) pages.push(i);
    }
    if (page < max - 2) pages.push("…");
    if (!pages.includes(max)) pages.push(max);
    return pages;
  }, [page, totalPages]);

  return (
    <div className="kp-page results-page">
      <section className="results-hero" ref={heroRef}>
        <p className="results-hero__resolved">
          <IconCheck size={28} style={{ color: "#cc0000" }} />
          <span className="results-hero__num">{heroCount}</span>
          <span>проблем решено</span>
        </p>
        <p className="results-hero__meta">
          Самая популярная категория: <strong>{topCategory}</strong>
        </p>
        <p className="results-hero__meta">
          Самый активный пользователь: <strong>{topUser}</strong>
        </p>
        <div className="results-hero__cta">
          <button type="button" className="kp-btn kp-btn--primary" onClick={openCreate}>
            СООБЩИТЬ О ПРОБЛЕМЕ →
          </button>
        </div>
      </section>

      <div className="kp-page__inner">
        <StatCounters stats={mapStats} />

        <h2 className="kp-section-title">Решённые проблемы</h2>
        {loadingResolved ? (
          <p className="results-empty">Загрузка…</p>
        ) : resolvedMarkers.length === 0 ? (
          <p className="results-empty">Пока нет решённых обращений.</p>
        ) : (
          <div className="results-grid">
            {resolvedMarkers.map((m) => {
              const labels = findCategoryLabels(taxonomy, m.domain_key);
              const photo = markerPhotoUrl(m);
              const addr =
                m.address_text?.trim() ||
                `${Number(m.latitude).toFixed(4)}, ${Number(m.longitude).toFixed(4)}`;

              return (
                <button
                  key={m.id}
                  type="button"
                  className="results-card"
                  onClick={() => openMarker(m.id)}
                >
                  <div className="results-card__media">
                    {photo ? (
                      <img src={photo} alt="" loading="lazy" />
                    ) : (
                      <div className="results-card__placeholder">
                        <IconPin size={40} style={{ color: "#cc0000", opacity: 0.3 }} />
                        <span>{labels?.domain || "Обращение"}</span>
                      </div>
                    )}
                    <span className="results-card__zoom" aria-hidden="true">
                      🔍
                    </span>
                  </div>
                  <div className="results-card__body">
                    <div className="results-card__badges">
                      {labels?.domain ? (
                        <span className="results-badge">{labels.domain}</span>
                      ) : null}
                      <span className="results-badge results-badge--ok">
                        ✅ Решено
                      </span>
                    </div>
                    <p className="results-card__text">{m.text || "Без описания"}</p>
                    <p className="results-card__line">📍 {addr}</p>
                    <p className="results-card__line">
                      👤 {m.user_email || "Житель"} · 📅{" "}
                      {formatDate(m.resolved_at || m.updated_at)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {totalPages > 1 ? (
          <nav className="results-pagination" aria-label="Страницы">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Предыдущая"
            >
              ‹
            </button>
            {pageNumbers.map((n, i) =>
              n === "…" ? (
                <span key={`e-${i}`} className="kp-muted">
                  …
                </span>
              ) : (
                <button
                  key={n}
                  type="button"
                  className={page === n ? "is-active" : ""}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              )
            )}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Следующая"
            >
              ›
            </button>
          </nav>
        ) : null}

        <h2 className="kp-section-title">Эффективность по категориям</h2>
        <div className="results-bars">
          {categoryBars.length === 0 ? (
            <p className="results-empty">Нет данных по категориям.</p>
          ) : (
            categoryBars.map((row) => <CategoryBar key={row.key} row={row} />)
          )}
        </div>

        <h2 className="kp-section-title">Самые активные участники</h2>
        {leaders.length === 0 ? (
          <p className="results-empty">Рейтинг пока пуст.</p>
        ) : (
          <div className="results-leaders-scroll">
            {leaders.map((u) => {
              const name = userDisplayLabel(
                { display_name: u.display_name, email: u.email },
                "Участник"
              );
              const avatar = resolveAvatarUrl(u.avatar_url);
              const points = u.points ?? u.karma_points ?? 0;
              return (
                <article key={u.user_id || u.rank} className="results-leader-card">
                  <div className="results-leader-card__avatar">
                    {avatar ? (
                      <img src={avatar} alt="" />
                    ) : (
                      <span>{userAvatarLetter({ display_name: name }, "?")}</span>
                    )}
                  </div>
                  <p className="results-leader-card__name">{name}</p>
                  <p className="results-leader-card__points">🏆 {points} баллов</p>
                  <p className="results-leader-card__meta">
                    #{u.rank} в рейтинге
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
