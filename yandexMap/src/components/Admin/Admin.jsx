import React, {
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { Link, useHistory } from "react-router-dom";
import { AuthContext } from "../Auth/AuthContext.jsx";
import { getAdminUsers, patchAdminUser } from "../../services/api.js";
import { showToast } from "../ToastHost.jsx";
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

const USER_ROLES = [
  { value: "user", label: "Пользователь", is_moderator: false, is_admin: false },
  { value: "moderator", label: "Модератор", is_moderator: true, is_admin: false },
  { value: "admin", label: "Администратор", is_moderator: true, is_admin: true },
];

function userRoleValue(u) {
  if (u.is_admin) return "admin";
  if (u.is_moderator) return "moderator";
  return "user";
}

function userRoleLabel(u) {
  return USER_ROLES.find((r) => r.value === userRoleValue(u))?.label || "Пользователь";
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

  const setUserRole = async (u, roleValue) => {
    if (u.id === user?.id && roleValue !== "admin") {
      setError("Нельзя снять с себя права администратора через интерфейс.");
      return;
    }
    const role = USER_ROLES.find((r) => r.value === roleValue);
    if (!role || userRoleValue(u) === roleValue) return;

    setBusyId(u.id);
    setError("");
    try {
      await patchAdminUser(u.id, {
        is_moderator: role.is_moderator,
        is_admin: role.is_admin,
      });
      await loadUsers();
      showToast(`Роль «${role.label}» назначена пользователю ${u.email}`, "success");
    } catch (e) {
      setError(e.message || "Ошибка");
      showToast(e.message || "Не удалось сменить роль", "error");
    } finally {
      setBusyId(null);
    }
  };

  if (!user?.is_admin && !user?.is_moderator) {
    return null;
  }

  return (
    <>
      <div className="profile-page page-aurora page-aurora--karta">
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

          {canManageUsers && (
          <section className="admin-section admin-section--users" id="admin-users">
            <h3>Роли пользователей</h3>
            <p className="mod-intro admin-intro">
              Назначайте роли: пользователь, модератор или администратор. После
              смены роли человеку нужно обновить страницу или войти заново.
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
                        <span
                          className={`admin-badge ${
                            u.is_admin
                              ? "admin-badge--gold"
                              : u.is_moderator
                                ? "admin-badge--mod"
                                : "admin-badge--user"
                          }`}
                        >
                          {userRoleLabel(u)}
                        </span>
                        <span className="admin-meta-muted">
                          Обращений: {u.markers_count ?? 0}
                        </span>
                      </div>
                      <div className="mod-review-actions admin-actions">
                        <label className="admin-role-field">
                          <span className="admin-role-label">Роль</span>
                          <select
                            className="admin-role-select"
                            value={userRoleValue(u)}
                            disabled={
                              busyId === u.id ||
                              (u.id === user?.id && u.is_admin)
                            }
                            onChange={(e) => setUserRole(u, e.target.value)}
                          >
                            {USER_ROLES.map((role) => (
                              <option key={role.value} value={role.value}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        {u.id === user?.id && u.is_admin ? (
                          <span className="admin-meta-muted admin-self-note">
                            Свою роль администратора здесь не меняют
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          )}

          <AdminClassifications />

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
