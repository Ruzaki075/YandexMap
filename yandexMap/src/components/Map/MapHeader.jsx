import React, {
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { Link, useHistory, useLocation } from "react-router-dom";
import { AuthContext } from "../Auth/AuthContext";
import {
  getNotifications,
  getNotificationsUnreadCount,
  getModerationStats,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../services/api.js";
import { resolveAvatarUrl } from "../../utils/avatarUrl.js";
import { userAvatarLetter } from "../../utils/userDisplay.js";
import "./MapHeader.css";

const COMPACT_HEADER = new Set(["/login", "/register"]);

function HeaderNotifications({ user, history, wrapRef, open, setOpen }) {
  const [notifItems, setNotifItems] = useState([]);
  const [notifUnread, setNotifUnread] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (!user) return;
    try {
      const n = await getNotificationsUnreadCount();
      setNotifUnread(n);
    } catch {
      /* ignore */
    }
  }, [user]);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getNotifications({ limit: 35, offset: 0 });
      setNotifItems(data.notifications || []);
    } catch {
      setNotifItems([]);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    refreshUnread();
    const t = setInterval(refreshUnread, 25000);
    const onVis = () => {
      if (document.visibilityState === "visible") refreshUnread();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user, refreshUnread]);

  useEffect(() => {
    const onRefresh = () => {
      refreshUnread();
      loadNotifications();
    };
    window.addEventListener("yandexmap:notifications", onRefresh);
    return () => window.removeEventListener("yandexmap:notifications", onRefresh);
  }, [refreshUnread, loadNotifications]);

  const toggleNotif = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      await loadNotifications();
      await refreshUnread();
    }
  };

  const handleNotifClick = async (n) => {
    const wasUnread = !n.read_at;
    try {
      await markNotificationRead(n.id);
    } catch {
      /* still navigate */
    }
    if (wasUnread) {
      setNotifUnread((u) => Math.max(0, u - 1));
    }
    setNotifItems((list) =>
      list.map((x) =>
        x.id === n.id ? { ...x, read_at: x.read_at || new Date().toISOString() } : x
      )
    );
    setOpen(false);
    const kind = (n.type || "").toLowerCase();
    if (kind === "abuse_report") {
      history.push("/moderation?tab=spam");
      return;
    }
    if (n.marker_id) {
      history.push(`/?marker=${n.marker_id}`);
    } else {
      history.push("/profile");
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      setNotifUnread(0);
      setNotifItems((list) =>
        list.map((x) => ({
          ...x,
          read_at: x.read_at || new Date().toISOString(),
        }))
      );
    } catch {
      /* */
    }
  };

  return (
    <div className="nav-notif-wrap nav-notif-wrap--header" ref={wrapRef}>
      <button
        type="button"
        className="nav-notif-bell"
        onClick={toggleNotif}
        aria-expanded={open}
        aria-label={
          notifUnread > 0
            ? `Уведомления, непрочитанных: ${notifUnread}`
            : "Уведомления"
        }
      >
        <svg
          className="nav-notif-icon"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {notifUnread > 0 ? (
          <span className="nav-notif-badge">
            {notifUnread > 99 ? "99+" : notifUnread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="nav-notif-dropdown" role="menu">
          <div className="nav-notif-head">
            <span className="nav-notif-title">Уведомления</span>
            <Link
              to="/notifications"
              className="nav-notif-allread"
              onClick={() => setOpen(false)}
            >
              Все →
            </Link>
            {notifItems.some((x) => !x.read_at) ? (
              <button
                type="button"
                className="nav-notif-allread"
                onClick={handleMarkAll}
              >
                Прочитать все
              </button>
            ) : null}
          </div>
          <div className="nav-notif-list">
            {notifItems.length === 0 ? (
              <p className="nav-notif-empty">Пока нет уведомлений</p>
            ) : (
              notifItems.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  role="menuitem"
                  className={`nav-notif-item${!n.read_at ? " nav-notif-item--new" : ""}`}
                  onClick={() => handleNotifClick(n)}
                >
                  <strong className="nav-notif-item-title">{n.title}</strong>
                  {n.body ? (
                    <span className="nav-notif-body">
                      {n.body.length > 160
                        ? `${n.body.slice(0, 160)}…`
                        : n.body}
                    </span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function MapHeader() {
  const { user, logout } = useContext(AuthContext);
  const history = useHistory();
  const { pathname } = useLocation();
  const compact = !COMPACT_HEADER.has(pathname);
  const wrapRef = useRef(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [overdueCount, setOverdueCount] = useState(0);

  const refreshOverdue = useCallback(async () => {
    if (!user?.is_moderator && !user?.is_admin) {
      setOverdueCount(0);
      return;
    }
    try {
      const st = await getModerationStats();
      setOverdueCount(st?.overdue_count ?? 0);
    } catch {
      setOverdueCount(0);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    refreshOverdue();
    const t = setInterval(refreshOverdue, 25000);
    return () => clearInterval(t);
  }, [user, refreshOverdue]);

  useEffect(() => {
    const h = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    if (notifOpen) {
      document.addEventListener("mousedown", h);
    }
    return () => document.removeEventListener("mousedown", h);
  }, [notifOpen]);

  return (
    <header className={`top-header${compact ? " top-header--compact" : ""}`}>
      <div className="header-inner">
        <Link to="/" className="logo" onClick={() => setMenuOpen(false)}>
          Карта<span>Проблем</span>
        </Link>

        <button
          type="button"
          className="nav-burger"
          aria-expanded={menuOpen}
          aria-label="Меню"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`nav-links${menuOpen ? " nav-links--open" : ""}`}>
          {!user ? (
            <>
              <Link to="/" onClick={() => setMenuOpen(false)}>
                Карта
              </Link>
              <Link to="/login" onClick={() => setMenuOpen(false)}>
                Войти
              </Link>
              <Link
                to="/register"
                className="btn-register"
                onClick={() => setMenuOpen(false)}
              >
                Регистрация
              </Link>
            </>
          ) : (
            <>
              <Link to="/" onClick={() => setMenuOpen(false)}>
                Карта
              </Link>
              {user?.is_admin ? (
                <Link
                  to="/admin"
                  className="nav-admin"
                  onClick={() => setMenuOpen(false)}
                >
                  Админ
                </Link>
              ) : null}
              {user?.is_moderator && !user?.is_admin ? (
                <Link
                  to="/admin"
                  className="nav-admin"
                  onClick={() => setMenuOpen(false)}
                >
                  Классификации
                </Link>
              ) : null}
              {(user?.is_moderator || user?.is_admin) && (
                <Link
                  to="/moderation"
                  className="nav-mod"
                  onClick={() => setMenuOpen(false)}
                >
                  Модерация
                  {overdueCount > 0 ? (
                    <span className="nav-notif-link-badge">{overdueCount}</span>
                  ) : null}
                </Link>
              )}
              <Link to="/stats" onClick={() => setMenuOpen(false)}>
                Статистика
              </Link>
              <Link
                to="/profile"
                className="nav-profile-link"
                onClick={() => setMenuOpen(false)}
              >
                {resolveAvatarUrl(user?.avatar_url) ? (
                  <img
                    src={resolveAvatarUrl(user.avatar_url)}
                    alt=""
                    className="nav-avatar-mini"
                  />
                ) : (
                  <span className="nav-avatar-mini nav-avatar-mini--letter">
                    {userAvatarLetter(user, (user.email || "?").charAt(0).toUpperCase())}
                  </span>
                )}
                Профиль
              </Link>
              <Link to="/leaderboard" onClick={() => setMenuOpen(false)}>
                Рейтинг
              </Link>
              <button type="button" onClick={logout} className="nav-logout-btn">
                Выйти
              </button>
            </>
          )}
        </nav>

        {user ? (
          <HeaderNotifications
            user={user}
            history={history}
            wrapRef={wrapRef}
            open={notifOpen}
            setOpen={setNotifOpen}
          />
        ) : null}
      </div>
    </header>
  );
}
