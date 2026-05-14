import React, { useContext, useEffect, useState, useCallback } from "react";
import { Link, useHistory } from "react-router-dom";
import MapHeader from "../Map/MapHeader.jsx";
import { AuthContext } from "../Auth/AuthContext.jsx";
import { getAdminUsers, patchAdminUser } from "../../services/api.js";
import "../Profile/Profile.css";
import "../Moderation/Moderation.css";
import "./Admin.css";

function formatUserDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ru-RU");
}

export default function Admin() {
  const { user } = useContext(AuthContext);
  const history = useHistory();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await getAdminUsers();
      const list = Array.isArray(data?.users) ? data.users : [];
      setUsers(list);
    } catch (e) {
      setUsers([]);
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
    if (!user.is_admin) {
      setLoading(false);
      history.push("/");
      return;
    }
    setLoading(true);
    load();
  }, [user, history, load]);

  const toggleModerator = async (u) => {
    setBusyId(u.id);
    setError("");
    try {
      await patchAdminUser(u.id, { is_moderator: !u.is_moderator });
      await load();
    } catch (e) {
      setError(e.message || "Ошибка");
    } finally {
      setBusyId(null);
    }
  };

  const toggleAdmin = async (u) => {
    if (u.id === user?.id && u.is_admin) {
      setError("Нельзя снять с себя права администратора через интерфейс.");
      return;
    }
    setBusyId(u.id);
    setError("");
    try {
      await patchAdminUser(u.id, { is_admin: !u.is_admin });
      await load();
    } catch (e) {
      setError(e.message || "Ошибка");
    } finally {
      setBusyId(null);
    }
  };

  if (!user?.is_admin) {
    return null;
  }

  return (
    <>
      <MapHeader />
      <div className="profile-page page-aurora">
        <div className="profile-container admin-container">
          <div className="section-header mod-section-head">
            <h2>Администрирование</h2>
            <div className="mod-head-actions">
              <button
                type="button"
                className="mod-refresh"
                onClick={() => {
                  setLoading(true);
                  load();
                }}
                disabled={loading}
              >
                Обновить
              </button>
              <Link to="/moderation" className="view-all">
                Модерация →
              </Link>
              <Link to="/" className="view-all">
                На карту →
              </Link>
            </div>
          </div>

          <p className="mod-intro admin-intro">
            Управление ролями: модераторы обрабатывают обращения на странице
            «Модерация». Администраторы видят этот раздел и могут назначать
            роли (кроме снятия собственных прав администратора). После смены
            ролей пользователю нужно заново войти в аккаунт, чтобы обновился
            доступ в меню.
          </p>

          {error && <div className="mod-alert">{error}</div>}

          {loading ? (
            <div className="mod-loading">
              <div className="loading-spinner" />
              <p>Загрузка пользователей…</p>
            </div>
          ) : users.length === 0 ? (
            <div className="empty-state mod-empty">
              <p>Пользователей пока нет.</p>
            </div>
          ) : (
            <div className="marks-list admin-user-list">
              {users.map((u) => (
                <div key={u.id} className="mark-item admin-user-row">
                  <div className="admin-user-avatar" aria-hidden="true">
                    {String(u.email || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="mark-content">
                    <div className="mod-review-top">
                      <span className="admin-email">{u.email}</span>
                      <span className="mod-review-date">
                        id {u.id} · {formatUserDate(u.created_at)}
                      </span>
                    </div>
                    <div className="admin-badges">
                      {u.is_admin && (
                        <span className="admin-badge admin-badge--gold">
                          Админ
                        </span>
                      )}
                      {u.is_moderator && (
                        <span className="admin-badge admin-badge--mod">
                          Модератор
                        </span>
                      )}
                      {!u.is_admin && !u.is_moderator && (
                        <span className="admin-badge admin-badge--user">
                          Пользователь
                        </span>
                      )}
                      <span className="admin-meta-muted">
                        Обращений: {u.markers_count ?? 0}
                      </span>
                    </div>
                    <div className="mod-review-actions admin-actions">
                      <button
                        type="button"
                        className="mod-action mod-action--muted"
                        disabled={busyId === u.id}
                        onClick={() => toggleModerator(u)}
                      >
                        {u.is_moderator
                          ? "Снять модератора"
                          : "Сделать модератором"}
                      </button>
                      <button
                        type="button"
                        className="mod-action mod-action--ok"
                        disabled={
                          busyId === u.id || (Boolean(u.is_admin) && u.id === user.id)
                        }
                        onClick={() => toggleAdmin(u)}
                      >
                        {u.is_admin ? "Снять админа" : "Сделать админом"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
