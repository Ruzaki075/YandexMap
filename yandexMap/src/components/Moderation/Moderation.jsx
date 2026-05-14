import React, {
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { Link, useHistory } from "react-router-dom";
import MapHeader from "../Map/MapHeader.jsx";
import { AuthContext } from "../Auth/AuthContext.jsx";
import {
  getMarkers,
  getModerationStats,
  patchMarkerStatus,
} from "../../services/api.js";
import {
  findCategoryLabels,
  formatCategoryLine,
} from "../../utils/issueLabels.js";
import issueTaxonomy from "@issue-taxonomy";
import {
  IconStatTotal,
  IconStatQueue,
  IconStatProcessed,
  IconStatMap,
  IconStatAuthors,
  IconStatToday,
  IconRowPending,
  IconRowRejected,
  IconRowOk,
} from "./ModerationIcons.jsx";
import "../Profile/Profile.css";
import "./Moderation.css";

const STATUS_LABEL = {
  pending: "На проверке",
  approved: "Одобрено",
  rejected: "Отклонено",
  resolved: "Решено",
};

const FILTERS = ["pending", "approved", "rejected", "resolved", "all"];

const PAGE_SIZE = 18;

function normStatus(m) {
  return m.status || "pending";
}

function formatMarkerDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ru-RU");
}

function startOfLocalDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const DOMAIN_CHIPS = [
  { key: "", label: "Все направления" },
  ...issueTaxonomy.domains.map((d) => ({ key: d.key, label: d.label_ru })),
  { key: "__none__", label: "Без направления" },
];

function formatReviewShort(m) {
  const c = m.review_count ?? 0;
  if (!c) return null;
  const avg =
    m.review_avg != null ? Number(m.review_avg).toFixed(1) : "—";
  return `Оценки: ${avg} ★ (${c})`;
}

const CLOSURE_LABELS = {
  under_1d: "до 1 сут.",
  d1_3d: "1–3 сут.",
  d3_7d: "3–7 сут.",
  over_7d: "свыше 7 сут.",
};

export default function Moderation() {
  const { user } = useContext(AuthContext);
  const history = useHistory();
  const [markers, setMarkers] = useState([]);
  const [listTotal, setListTotal] = useState(0);
  const [modStats, setModStats] = useState(null);
  const [filter, setFilter] = useState("pending");
  const [domainFilter, setDomainFilter] = useState("");
  const [modPage, setModPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectNote, setRejectNote] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const statusParam = filter === "all" ? "all" : filter;
      const domainParam =
        domainFilter && domainFilter !== "" ? domainFilter : undefined;

      const [statsData, markersData] = await Promise.all([
        getModerationStats(),
        getMarkers({
          page: modPage,
          page_size: PAGE_SIZE,
          status: statusParam,
          domain_key: domainParam,
        }),
      ]);

      setModStats(statsData);
      const list = Array.isArray(markersData?.markers)
        ? markersData.markers
        : [];
      setMarkers(list);
      setListTotal(
        typeof markersData?.total === "number"
          ? markersData.total
          : list.length
      );
    } catch (e) {
      setMarkers([]);
      setListTotal(0);
      setError(e.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [filter, domainFilter, modPage, refreshTick]);

  useEffect(() => {
    if (!user) {
      history.push("/login");
      return;
    }
    if (!user.is_moderator && !user.is_admin) {
      setLoading(false);
      history.push("/");
      return;
    }
    setLoading(true);
    load();
  }, [user, history, load]);

  useEffect(() => {
    setModPage(1);
  }, [filter, domainFilter]);

  const stats = modStats
    ? (() => {
        const bs = modStats.by_status || {};
        const pending = bs.pending ?? 0;
        const approved = bs.approved ?? 0;
        const rejected = bs.rejected ?? 0;
        const resolved = bs.resolved ?? 0;
        const total = modStats.total ?? 0;
        const onMap = total - rejected;
        const processed = approved + rejected + resolved;
        const dayStart = startOfLocalDay();
        let todayCreated = 0;
        let todayUpdated = 0;
        const authorIds = new Set();
        for (const m of markers) {
          if (m.user_id) authorIds.add(m.user_id);
          const cAt = new Date(m.created_at);
          if (!Number.isNaN(cAt.getTime()) && cAt >= dayStart) {
            todayCreated += 1;
          }
          const uAt = new Date(m.updated_at || m.created_at);
          if (!Number.isNaN(uAt.getTime()) && uAt >= dayStart) {
            todayUpdated += 1;
          }
        }
        return {
          pending,
          approved,
          rejected,
          resolved,
          total,
          onMap,
          processed,
          needAction: pending,
          authors: authorIds.size,
          todayCreated,
          todayUpdated,
        };
      })()
    : {
        pending: 0,
        approved: 0,
        rejected: 0,
        resolved: 0,
        total: 0,
        onMap: 0,
        processed: 0,
        needAction: 0,
        authors: 0,
        todayCreated: 0,
        todayUpdated: 0,
      };

  const domainCount = (key) => {
    const bd = modStats?.by_domain;
    if (!bd) return 0;
    if (key === "") {
      return modStats.total ?? 0;
    }
    return bd[key] ?? 0;
  };

  const setStatus = async (id, status, moderatorNote) => {
    setBusyId(id);
    setError("");
    try {
      await patchMarkerStatus(id, status, moderatorNote);
      setLoading(true);
      await load();
      window.dispatchEvent(new Event("yandexmap:notifications"));
    } catch (e) {
      setError(e.message || "Ошибка");
    } finally {
      setBusyId(null);
    }
  };

  const confirmReject = async () => {
    if (!rejectModal) return;
    const id = rejectModal.id;
    const note = rejectNote.trim();
    setRejectModal(null);
    setRejectNote("");
    await setStatus(id, "rejected", note || undefined);
  };

  const filterLabel = (key) =>
    key === "all" ? "Все" : STATUS_LABEL[key] || key;

  const handleRefresh = () => {
    setRefreshTick((t) => t + 1);
  };

  const totalPages = Math.max(1, Math.ceil(listTotal / PAGE_SIZE));

  if (!user?.is_moderator && !user?.is_admin) {
    return null;
  }

  return (
    <>
      <MapHeader />
      <div className="profile-page page-aurora">
        <div className="profile-container mod-container">
          <div className="section-header mod-section-head">
            <h2 className="mod-page-title">
              <span className="mod-title-icon" aria-hidden>
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </span>
              Модерация обращений
            </h2>
            <div className="mod-head-actions">
              <button
                type="button"
                className="mod-refresh"
                onClick={handleRefresh}
                disabled={loading}
              >
                Обновить
              </button>
              <Link to="/" className="view-all">
                На карту →
              </Link>
            </div>
          </div>

          <div className="stats-grid mod-stats">
            <div className="stat-card">
              <div className="stat-icon total mod-stat-svg">
                <IconStatTotal />
              </div>
              <div className="stat-content">
                <h3>{stats.total}</h3>
                <p>Всего обращений</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon pending mod-stat-svg">
                <IconStatQueue />
              </div>
              <div className="stat-content">
                <h3>{stats.needAction}</h3>
                <p>Очередь на решение</p>
                <p className="stat-hint">статус «на проверке»</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon resolved mod-stat-svg">
                <IconStatProcessed />
              </div>
              <div className="stat-content">
                <h3>{stats.processed}</h3>
                <p>Обработано всего</p>
                <p className="stat-hint">одобрено, отклонено или решено</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon total mod-stat-svg">
                <IconStatMap />
              </div>
              <div className="stat-content">
                <h3>{stats.onMap}</h3>
                <p>На карте сейчас</p>
                <p className="stat-hint">все кроме отклонённых</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon pending mod-stat-svg">
                <IconStatAuthors />
              </div>
              <div className="stat-content">
                <h3>{stats.authors}</h3>
                <p>На этой странице</p>
                <p className="stat-hint">уникальных авторов в списке</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon resolved mod-stat-svg">
                <IconStatToday />
              </div>
              <div className="stat-content">
                <h3>{stats.todayCreated}</h3>
                <p>Новых на странице</p>
                <p className="stat-hint">созданы сегодня (в текущем списке)</p>
              </div>
            </div>
          </div>

          <div className="mod-breakdown">
            <span className="mod-breakdown-item mod-b--ok">
              Одобрено: <strong>{stats.approved}</strong>
            </span>
            <span className="mod-breakdown-item mod-b--bad">
              Отклонено: <strong>{stats.rejected}</strong>
            </span>
            <span className="mod-breakdown-item mod-b--done">
              Решено: <strong>{stats.resolved}</strong>
            </span>
            <span className="mod-breakdown-item mod-b--muted">
              Изменений сегодня (на стр.): <strong>{stats.todayUpdated}</strong>
            </span>
          </div>

          <section className="mod-insights" aria-label="Сводка по всей базе">
            <h3 className="mod-insights-title">По всей базе</h3>
            <div className="mod-insights-grid">
              <div className="mod-insights-card">
                <span className="mod-insights-label">Доля отклонений</span>
                <p className="mod-insights-value">
                  {modStats &&
                  modStats.processed > 0 &&
                  modStats.rejection_rate != null
                    ? `${(Number(modStats.rejection_rate) * 100).toFixed(1)}%`
                    : "—"}
                </p>
                <p className="mod-insights-hint">
                  отклонено / (принято + отклонено + решено)
                </p>
              </div>
              <div className="mod-insights-card mod-insights-card--wide">
                <span className="mod-insights-label">
                  Время до смены статуса (создание → последнее обновление)
                </span>
                {modStats?.closure_time_buckets?.length ? (
                  <ul className="mod-insights-bars">
                    {(() => {
                      const maxC = Math.max(
                        ...modStats.closure_time_buckets.map((x) => x.count),
                        1
                      );
                      return modStats.closure_time_buckets.map((row) => (
                        <li key={row.key}>
                          <span className="mod-insights-bar-name">
                            {CLOSURE_LABELS[row.key] || row.key}
                          </span>
                          <span className="mod-insights-bar-track">
                            <span
                              className="mod-insights-bar-fill"
                              style={{
                                width: `${(row.count / maxC) * 100}%`,
                              }}
                            />
                          </span>
                          <span className="mod-insights-bar-count">
                            {row.count}
                          </span>
                        </li>
                      ));
                    })()}
                  </ul>
                ) : (
                  <p className="mod-insights-empty">Пока нет обработанных меток</p>
                )}
              </div>
            </div>
          </section>

          <div
            className="mod-filters"
            role="tablist"
            aria-label="Фильтр по статусу"
          >
            {FILTERS.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                className={`mod-chip${filter === key ? " mod-chip--active" : ""}`}
                onClick={() => setFilter(key)}
              >
                {filterLabel(key)}
                {key !== "all" && modStats?.by_status && (
                  <span className="mod-chip-count">
                    {modStats.by_status[key] ?? 0}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div
            className="mod-domain-bar"
            role="tablist"
            aria-label="Направление проблемы"
          >
            {DOMAIN_CHIPS.map((d) => (
              <button
                key={d.key || "__all__"}
                type="button"
                role="tab"
                aria-selected={domainFilter === d.key}
                className={`mod-domain-chip${domainFilter === d.key ? " mod-domain-chip--active" : ""}`}
                onClick={() => setDomainFilter(d.key)}
              >
                <span className="mod-domain-chip-label">{d.label}</span>
                <span className="mod-domain-chip-count">{domainCount(d.key)}</span>
              </button>
            ))}
          </div>

          {error && <div className="mod-alert">{error}</div>}

          {loading ? (
            <div className="mod-loading">
              <div className="loading-spinner" />
              <p>Загрузка очереди…</p>
            </div>
          ) : markers.length === 0 ? (
            <div className="empty-state mod-empty">
              <p>В этом сочетании фильтров нет обращений.</p>
            </div>
          ) : (
            <>
              <div className="marks-list mod-marks">
                {markers.map((m) => {
                  const st = normStatus(m);
                  const cat = findCategoryLabels(issueTaxonomy, m.domain_key);
                  const catLine = formatCategoryLine(cat);
                  const revLine = formatReviewShort(m);
                  return (
                    <div
                      key={m.id}
                      className="mark-item mod-review"
                      data-status={st}
                    >
                      <div
                        className="mark-status mod-row-status"
                        data-status={st}
                      >
                        {st === "pending" ? (
                          <IconRowPending />
                        ) : st === "rejected" ? (
                          <IconRowRejected />
                        ) : (
                          <IconRowOk />
                        )}
                      </div>
                      <div className="mark-content mod-review-body">
                        <div className="mod-review-top">
                          <span className="mod-review-badge">
                            {STATUS_LABEL[st]}
                          </span>
                          <span className="mod-review-date">
                            {formatMarkerDate(m.created_at)}
                          </span>
                        </div>
                        {catLine ? (
                          <div className="mod-review-cat">{catLine}</div>
                        ) : null}
                        {revLine ? (
                          <div className="mod-review-rating-line">{revLine}</div>
                        ) : null}
                        {m.moderator_note ? (
                          <div className="mod-mod-note">
                            <span className="mod-mod-note-label">
                              Комментарий модератора
                            </span>
                            {m.moderator_note}
                          </div>
                        ) : null}
                        <h4>{m.text || "—"}</h4>
                        <div className="mark-meta">
                          <span className="mark-date">
                            {m.user_email || `Пользователь #${m.user_id}`}
                          </span>
                        </div>
                        <div className="mod-review-actions">
                          {st !== "approved" && (
                            <button
                              type="button"
                              className="mod-action mod-action--ok"
                              disabled={busyId === m.id}
                              onClick={() => setStatus(m.id, "approved")}
                            >
                              Принять
                            </button>
                          )}
                          {st !== "rejected" && (
                            <button
                              type="button"
                              className="mod-action mod-action--bad"
                              disabled={busyId === m.id}
                              onClick={() => {
                                setRejectNote("");
                                setRejectModal({
                                  id: m.id,
                                  title: (m.text || "—").slice(0, 120),
                                });
                              }}
                            >
                              Отклонить
                            </button>
                          )}
                          {st !== "pending" && (
                            <button
                              type="button"
                              className="mod-action mod-action--muted"
                              disabled={busyId === m.id}
                              onClick={() => setStatus(m.id, "pending")}
                            >
                              В очередь
                            </button>
                          )}
                          {st !== "resolved" && (
                            <button
                              type="button"
                              className="mod-action mod-action--muted"
                              disabled={busyId === m.id}
                              onClick={() => setStatus(m.id, "resolved")}
                            >
                              Решено
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mod-pagination">
                <button
                  type="button"
                  className="mod-page-btn"
                  disabled={modPage <= 1 || loading}
                  onClick={() => setModPage((p) => Math.max(1, p - 1))}
                >
                  ← Назад
                </button>
                <span className="mod-page-info">
                  Стр. {modPage} из {totalPages} · показано {markers.length} из{" "}
                  {listTotal}
                </span>
                <button
                  type="button"
                  className="mod-page-btn"
                  disabled={modPage >= totalPages || loading}
                  onClick={() =>
                    setModPage((p) => Math.min(totalPages, p + 1))
                  }
                >
                  Вперёд →
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {rejectModal && (
        <div
          className="mod-reject-overlay"
          role="presentation"
          onClick={() => {
            setRejectModal(null);
            setRejectNote("");
          }}
        >
          <div
            className="mod-reject-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mod-reject-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="mod-reject-title" className="mod-reject-title">
              Отклонить обращение
            </h3>
            <p className="mod-reject-preview">{rejectModal.title}</p>
            <label className="mod-reject-label" htmlFor="mod-reject-note">
              Причина (необязательно, видна в панели модерации)
            </label>
            <textarea
              id="mod-reject-note"
              className="mod-reject-textarea"
              rows={3}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Например: дубликат, не по теме, недостаточно данных…"
            />
            <div className="mod-reject-actions">
              <button
                type="button"
                className="mod-action mod-action--muted"
                onClick={() => {
                  setRejectModal(null);
                  setRejectNote("");
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                className="mod-action mod-action--bad"
                disabled={busyId === rejectModal.id}
                onClick={confirmReject}
              >
                Отклонить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
