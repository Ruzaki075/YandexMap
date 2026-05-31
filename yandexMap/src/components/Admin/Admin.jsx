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
import { getAdminUsers, patchAdminUser } from "../../services/api.js";
import AdminClassifications from "./AdminClassifications.jsx";
import "../Profile/Profile.css";
import "../Moderation/Moderation.css";
import { resolveAvatarUrl } from "../../utils/avatarUrl.js";
import AdminAuditLog from "./AdminAuditLog.jsx";
import "./Admin.css";

function formatUserDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ru-RU");
}

export default function Admin() {
  const { user, refreshSession } = useContext(AuthContext);
  const history = useHistory();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [userSearch, setUserSearch] = useState("");

  const loadUsers = useCallback(async () => {
    setError("");
    try {
      const data = await getAdminUsers();
      const list = Array.isArray(data?.users) ? data.users : [];
      setUsers(list);
    } catch (e) {
      setUsers([]);
      setError(e.message || "Ошибка загрузки");
    }
  }, []);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => (u.email || "").toLowerCase().includes(q));
  }, [users, userSearch]);

  const load = useCallback(
    async (sessionUser) => {
      const u = sessionUser ?? user;
      if (!u) return;
      if (u.is_admin) {
        setLoading(true);
        try {
          await loadUsers();
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    },
    [user, loadUsers]
  );

  useEffect(() => {
    if (!user) {
      history.push("/login");
      return;
    }
    let cancelled = false;
    (async () => {
      const fresh = await refreshSession();
      if (cancelled) return;
      const u = fresh ?? user;
      if (!u?.is_admin && !u?.is_moderator) {
        setLoading(false);
        history.push("/");
        return;
      }
      await load(u);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, history, load, refreshSession]);

  const canManageUsers = Boolean(user?.is_admin);

  const toggleModerator = async (u) => {
    setBusyId(u.id);
    setError("");
    try {
      await patchAdminUser(u.id, { is_moderator: !u.is_moderator });
      await loadUsers();
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
      await loadUsers();
    } catch (e) {
      setError(e.message || "Ошибка");
    } finally {
      setBusyId(null);
    }
  };

  if (!user?.is_admin && !user?.is_moderator) {
    return null;
  }

  return (
    <>
      <MapHeader />
      <div className="profile-page page-aurora">
        <div className="profile-container admin-container admin-container--wide">
          <div className="section-header mod-section-head">
            <h2>
              {user.is_admin ? "Администрирование" : "Классификации направлений"}
            </h2>
            <div className="mod-head-actions">
              <button
                type="button"
                className="mod-refresh"
                onClick={() => load()}
                disabled={loading}
              >
                Обновить
              </button>
              {(user.is_moderator || user.is_admin) && (
                <Link to="/moderation" className="view-all">
                  Модерация →
                </Link>
              )}
              <Link to="/" className="view-all">
                На карту →
              </Link>
            </div>
          </div>

          <AdminClassifications />

          {canManageUsers && (
          <section className="admin-section">
            <h3>Пользователи</h3>
            <p className="mod-intro admin-intro">
              Модераторы обрабатывают обращения. После смены ролей пользователю
              нужно заново войти в аккаунт.
            </p>
            {error && <div className="mod-alert">{error}</div>}
            <input
              type="search"
              className="admin-user-search"
              placeholder="Поиск по email…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />

            {loading ? (
              <div className="mod-loading">
                <div className="loading-spinner" />
                <p>Загрузка пользователей…</p>
              </div>
            ) : users.length === 0 ? (
              <div className="empty-state mod-empty">
                <p>Пользователей пока нет.</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="empty-state mod-empty">
                <p>Никого не найдено по запросу «{userSearch}».</p>
              </div>
            ) : (
              <div className="marks-list admin-user-list">
                {filteredUsers.map((u) => (
                  <div key={u.id} className="mark-item admin-user-row">
                    <div className="admin-user-avatar" aria-hidden="true">
                      {resolveAvatarUrl(u.avatar_url) ? (
                        <img
                          src={resolveAvatarUrl(u.avatar_url)}
                          alt=""
                          className="admin-user-avatar-img"
                        />
                      ) : (
                        String(u.email || "?").charAt(0).toUpperCase()
                      )}
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
                            busyId === u.id ||
                            (Boolean(u.is_admin) && u.id === user.id)
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
          </section>
          )}

          {user.is_admin ? (
            <section className="admin-section">
              <div className="admin-section-head">
                <h3>Журнал аудита</h3>
              </div>
              <AdminAuditLog />
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
