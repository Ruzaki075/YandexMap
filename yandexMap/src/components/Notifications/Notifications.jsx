import React, { useCallback, useContext, useEffect, useState } from "react";
import { Link, useHistory } from "react-router-dom";
import MapHeader from "../Map/MapHeader.jsx";
import { AuthContext } from "../Auth/AuthContext.jsx";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../services/api.js";
import "../Profile/Profile.css";
import "./Notifications.css";
import {
  notifIcon,
  groupNotificationsByDay,
} from "../../utils/notificationMeta.js";

function formatWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("ru-RU");
}

export default function Notifications() {
  const { user } = useContext(AuthContext);
  const history = useHistory();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications({ limit: 80, offset: 0 });
      setItems(data.notifications || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      history.push("/login");
      return;
    }
    load();
  }, [user, history, load]);

  const openNotif = async (n) => {
    try {
      if (!n.read_at) await markNotificationRead(n.id);
    } catch {
      /* */
    }
    window.dispatchEvent(new CustomEvent("yandexmap:notifications"));
    if (n.marker_id) history.push(`/?marker=${n.marker_id}`);
    else history.push("/profile");
  };

  const markAll = async () => {
    try {
      await markAllNotificationsRead();
      setItems((list) =>
        list.map((x) => ({
          ...x,
          read_at: x.read_at || new Date().toISOString(),
        }))
      );
      window.dispatchEvent(new CustomEvent("yandexmap:notifications"));
    } catch {
      /* */
    }
  };

  if (!user) return null;

  const grouped = groupNotificationsByDay(items);
  const renderGroup = (label, list) => {
    if (!list.length) return null;
    return (
      <div key={label} className="notif-page-group">
        <h3 className="notif-page-group-title">{label}</h3>
        {list.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`notif-page-item${!n.read_at ? " notif-page-item--new" : ""}`}
            onClick={() => openNotif(n)}
          >
            <span className="notif-page-icon" aria-hidden="true">
              {notifIcon(n.type)}
            </span>
            <span className="notif-page-item-body">
              <strong>{n.title}</strong>
              {n.body ? <span>{n.body}</span> : null}
              <time>{formatWhen(n.created_at)}</time>
            </span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <>
      <MapHeader />
      <div className="profile-page page-aurora">
        <div className="profile-container notif-page">
          <div className="section-header mod-section-head">
            <h2>Уведомления</h2>
            <div className="mod-head-actions">
              {items.some((x) => !x.read_at) ? (
                <button type="button" className="mod-refresh" onClick={markAll}>
                  Прочитать все
                </button>
              ) : null}
              <Link to="/profile" className="view-all">
                Профиль →
              </Link>
            </div>
          </div>

          {loading ? (
            <p className="admin-meta-muted">Загрузка…</p>
          ) : items.length === 0 ? (
            <div className="empty-state mod-empty">
              <p>Пока нет уведомлений.</p>
              <p className="admin-meta-muted">
                Подайте обращение на карте или включите геоподписку в профиле.
              </p>
              <Link to="/" className="view-all">
                На карту →
              </Link>
            </div>
          ) : (
            <div className="notif-page-list">
              {renderGroup("Сегодня", grouped.today)}
              {renderGroup("Вчера", grouped.yesterday)}
              {renderGroup("Ранее", grouped.earlier)}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
