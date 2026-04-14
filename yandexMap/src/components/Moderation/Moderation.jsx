import React, {
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { Link, useHistory } from "react-router-dom";
import MapHeader from "../Map/MapHeader.jsx";
import { AuthContext } from "../Auth/AuthContext.jsx";
import { getMarkers, patchMarkerStatus } from "../../services/api.js";
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

export default function Moderation() {
  const { user } = useContext(AuthContext);
  const history = useHistory();
  const [markers, setMarkers] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await getMarkers();
      const list = Array.isArray(data) ? data : data.markers || [];
      setMarkers(Array.isArray(list) ? list : []);
    } catch (e) {
      setMarkers([]);
      setError(e.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      history.push("/login");
      return;
    }
    if (!user.is_moderator) {
      setLoading(false);
      history.push("/");
      return;
    }
    setLoading(true);
    load();
  }, [user, history, load, refreshTick]);

  const stats = useMemo(() => {
    const list = markers;
    const counts = { pending: 0, approved: 0, rejected: 0, resolved: 0 };
    const dayStart = startOfLocalDay();
    let todayCreated = 0;
    let todayUpdated = 0;
    const authorIds = new Set();

    for (const m of list) {
      const s = normStatus(m);
      if (Object.prototype.hasOwnProperty.call(counts, s)) {
        counts[s] += 1;
      }
      if (m.user_id) authorIds.add(m.user_id);

      const cAt = new Date(m.created_at);
      if (!Number.isNaN(cAt.getTime()) && cAt >= dayStart) todayCreated += 1;

      const uAt = new Date(m.updated_at || m.created_at);
      if (!Number.isNaN(uAt.getTime()) && uAt >= dayStart) todayUpdated += 1;
    }

    const total = list.length;
    const onMap = list.filter((m) => normStatus(m) !== "rejected").length;
    const processed = counts.approved + counts.rejected + counts.resolved;
    const needAction = counts.pending;

    return {
      ...counts,
      total,
      onMap,
      processed,
      needAction,
      authors: authorIds.size,
      todayCreated,
      todayUpdated,
    };
  }, [markers]);

  const setStatus = async (id, status) => {
    setBusyId(id);
    setError("");
    try {
      await patchMarkerStatus(id, status);
      setLoading(true);
      await load();
    } catch (e) {
      setError(e.message || "Ошибка");
    } finally {
      setBusyId(null);
    }
  };

  const filtered =
    filter === "all"
      ? markers
      : markers.filter((m) => normStatus(m) === filter);

  const sorted = [...filtered].sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });

  const filterLabel = (key) =>
    key === "all" ? "Все" : STATUS_LABEL[key] || key;

  const handleRefresh = () => {
    setRefreshTick((t) => t + 1);
  };

  if (!user?.is_moderator) {
    return null;
  }

  return (
    <>
      <MapHeader />
      <div className="profile-page">
        <div className="profile-container mod-container">
          <div className="section-header mod-section-head">
            <h2>Модерация обращений</h2>
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

          <p className="mod-intro">
            Одобренные и ожидающие проверки видны на карте; отклонённые скрыты
            с карты. В профиле автора одобренные метки учитываются в блоке
            «Принято / решено».
          </p>

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
                <p>Авторов</p>
                <p className="stat-hint">уникальных пользователей</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon resolved mod-stat-svg">
                <IconStatToday />
              </div>
              <div className="stat-content">
                <h3>{stats.todayCreated}</h3>
                <p>Новых сегодня</p>
                <p className="stat-hint">по дате создания</p>
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
              Изменений сегодня: <strong>{stats.todayUpdated}</strong>
            </span>
          </div>

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
                {key !== "all" && (
                  <span className="mod-chip-count">
                    {markers.filter((m) => normStatus(m) === key).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {error && <div className="mod-alert">{error}</div>}

          {loading ? (
            <div className="mod-loading">
              <div className="loading-spinner" />
              <p>Загрузка очереди…</p>
            </div>
          ) : sorted.length === 0 ? (
            <div className="empty-state mod-empty">
              <p>В этом фильтре пока нет обращений.</p>
            </div>
          ) : (
            <div className="marks-list mod-marks">
              {sorted.map((m) => {
                const st = normStatus(m);
                const cat = findCategoryLabels(issueTaxonomy, m.domain_key);
                const catLine = formatCategoryLine(cat);
                return (
                  <div
                    key={m.id}
                    className="mark-item mod-review"
                    data-status={st}
                  >
                    <div className="mark-status mod-row-status" data-status={st}>
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
                            onClick={() => setStatus(m.id, "rejected")}
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
          )}
        </div>
      </div>
    </>
  );
}
