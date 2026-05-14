import React, {
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { Link, useHistory } from "react-router-dom";
import { AuthContext } from "../Auth/AuthContext";
import {
  getNotifications,
  getNotificationsUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../services/api.js";
import "./MapHeader.css";

export default function MapHeader() {
  const { user, logout } = useContext(AuthContext);
  const history = useHistory();
  const wrapRef = useRef(null);
  const [notifOpen, setNotifOpen] = useState(false);
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

  const toggleNotif = async () => {
    const next = !notifOpen;
    setNotifOpen(next);
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
    setNotifOpen(false);
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
    <header className="top-header">
      <div className="header-inner">
        <div className="logo">
          Карта<span>Проблем</span>
        </div>

        <nav className="nav-links">
          {!user ? (
            <>
              <Link to="/">Карта</Link>
              <Link to="/login">Войти</Link>
              <Link to="/register" className="btn-register">
                Регистрация
              </Link>
            </>
          ) : (
            <>
              <Link to="/">Карта</Link>
              {user?.is_admin && (
                <Link to="/admin" className="nav-admin">
                  Админ
                </Link>
              )}
              {(user?.is_moderator || user?.is_admin) && (
                <Link to="/moderation" className="nav-mod">
                  Модерация
                </Link>
              )}
              <Link to="/profile">Профиль</Link>

              <button
                type="button"
                onClick={logout}
                className="nav-logout-btn"
              >
                Выйти
              </button>
              <div className="nav-notif-wrap" ref={wrapRef}>
                <button
                  type="button"
                  className="nav-notif-bell"
                  onClick={toggleNotif}
                  aria-expanded={notifOpen}
                  aria-label="Уведомления"
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
                {notifOpen ? (
                  <div className="nav-notif-dropdown" role="menu">
                    <div className="nav-notif-head">
                      <span className="nav-notif-title">Уведомления</span>
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
                            <strong className="nav-notif-item-title">
                              {n.title}
                            </strong>
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
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
