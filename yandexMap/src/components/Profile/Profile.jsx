import React, { useState, useEffect, useCallback, useContext, useMemo, useRef } from "react";
import { useHistory, Link } from "react-router-dom";
import MapHeader from "../Map/MapHeader.jsx";
import { AuthContext } from "../Auth/AuthContext.jsx";
import {
  IconRowPending,
  IconRowRejected,
  IconRowOk,
} from "../Moderation/ModerationIcons.jsx";
import {
  getMyMarkers,
  deleteMarker,
  patchMarkerText,
  uploadAvatar,
  deleteAvatar,
  changePassword,
  patchMyProfile,
} from "../../services/api.js";
import { showToast } from "../ToastHost.jsx";
import { formatDueLine, STATUS_LABELS } from "../../utils/slaLabels.js";
import { resolveAvatarUrl } from "../../utils/avatarUrl.js";
import { userAvatarLetter } from "../../utils/userDisplay.js";
import ProfileFavorites from "./ProfileFavorites.jsx";
import "./Profile.css";

const PROFILE_FILTERS = [
  { key: "all", label: "Все" },
  { key: "pending", label: "На проверке" },
  { key: "approved", label: "Активные" },
  { key: "in_progress", label: "В работе" },
  { key: "resolved", label: "Решённые" },
  { key: "rejected", label: "Отклонённые" },
];

function statusLabel(status) {
  return STATUS_LABELS[status] || status || "На проверке";
}

const Profile = () => {
  const { user, logout, updateUser } = useContext(AuthContext);
  const avatarInputRef = useRef(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const history = useHistory();
  const [userMarkers, setUserMarkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileTab, setProfileTab] = useState("markers");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busyDeleteId, setBusyDeleteId] = useState(null);
  const [editMarker, setEditMarker] = useState(null);
  const [editText, setEditText] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const loadUserData = useCallback(async () => {
    if (!user) {
      history.push("/login");
      return;
    }
    setLoading(true);
    try {
      const data = await getMyMarkers();
      setUserMarkers(data?.markers || []);
    } catch (error) {
      console.error("Ошибка загрузки данных:", error);
      setUserMarkers([]);
    } finally {
      setLoading(false);
    }
  }, [user, history]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const stats = useMemo(() => {
    const markers = userMarkers;
    return {
      total: markers.length,
      pending: markers.filter((m) => (m.status || "pending") === "pending")
        .length,
      active: markers.filter((m) =>
        ["approved", "in_progress"].includes(m.status || "")
      ).length,
      resolved: markers.filter((m) => m.status === "resolved").length,
      rejected: markers.filter((m) => m.status === "rejected").length,
    };
  }, [userMarkers]);

  const filteredMarkers = useMemo(() => {
    if (statusFilter === "all") return userMarkers;
    if (statusFilter === "approved") {
      return userMarkers.filter((m) =>
        ["approved", "in_progress"].includes(m.status || "")
      );
    }
    return userMarkers.filter((m) => (m.status || "pending") === statusFilter);
  }, [userMarkers, statusFilter]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const handleViewMarker = (markerId) => {
    history.push(`/?marker=${markerId}`);
  };

  const avatarSrc = resolveAvatarUrl(user?.avatar_url);

  const handleAvatarPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast("Максимальный размер аватара — 2 МБ", "error");
      return;
    }
    setAvatarBusy(true);
    try {
      const res = await uploadAvatar(file);
      updateUser({ avatar_url: res.avatar_url });
      showToast("Аватар обновлён", "success");
    } catch (err) {
      showToast(err.message || "Ошибка загрузки", "error");
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarBusy(true);
    try {
      await deleteAvatar();
      updateUser({ avatar_url: null });
      showToast("Аватар удалён", "success");
    } catch (err) {
      showToast(err.message || "Ошибка", "error");
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editMarker) return;
    setEditBusy(true);
    try {
      await patchMarkerText(editMarker.id, editText.trim());
      showToast("Описание обновлено", "success");
      setEditMarker(null);
      await loadUserData();
    } catch (e) {
      showToast(e.message || "Ошибка", "error");
    } finally {
      setEditBusy(false);
    }
  };

  const handleDelete = async (marker) => {
    if (
      !window.confirm(
        "Удалить обращение? Это действие нельзя отменить."
      )
    ) {
      return;
    }
    setBusyDeleteId(marker.id);
    try {
      await deleteMarker(marker.id);
      showToast("Обращение удалено", "success");
      await loadUserData();
    } catch (e) {
      showToast(e.message || "Ошибка удаления", "error");
    } finally {
      setBusyDeleteId(null);
    }
  };

  if (loading) {
    return (
      <>
        <MapHeader />
        <div className="profile-page page-aurora">
          <div className="profile-loading">
            <div className="loading-spinner" />
            <p>Загрузка профиля...</p>
          </div>
        </div>
      </>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <MapHeader />

      <div className="profile-page page-aurora">
        <div className="profile-container">
          <div className="profile-header">
            <div className="profile-avatar">
              <div className="avatar-circle-wrap">
                <div className="avatar-circle avatar-circle--has-actions">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="" className="avatar-img" />
                  ) : (
                  <span className="avatar-letter">
                    {userAvatarLetter(user, user.email.charAt(0).toUpperCase())}
                  </span>
                  )}
                </div>
                <div className="online-dot" />
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="avatar-file-input"
                onChange={handleAvatarPick}
              />
              <div className="avatar-actions">
                <button
                  type="button"
                  className="avatar-btn"
                  disabled={avatarBusy}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {avatarBusy ? "…" : "Сменить фото"}
                </button>
                {avatarSrc ? (
                  <button
                    type="button"
                    className="avatar-btn avatar-btn--muted"
                    disabled={avatarBusy}
                    onClick={handleAvatarRemove}
                  >
                    Удалить
                  </button>
                ) : null}
              </div>
            </div>

            <div className="profile-info">
              <ProfileMessengerName user={user} updateUser={updateUser} />
              <p className="profile-role">
                {user.is_admin
                  ? "Администратор"
                  : user.is_moderator
                    ? "Модератор"
                    : "Активный пользователь"}
              </p>
              <p className="profile-join-date">
                <Link to="/notifications" className="profile-notif-link">
                  Уведомления →
                </Link>
                {" · "}
                <Link to="/leaderboard" className="profile-notif-link">
                  Рейтинг активистов →
                </Link>
              </p>
            </div>

            <button type="button" className="logout-btn" onClick={logout}>
              <span>Выйти</span>
            </button>
          </div>

          <div className="stats-grid stats-grid--5">
            <div className="stat-card">
              <div className="stat-content">
                <h3>{stats.total}</h3>
                <p>Всего</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <h3>{stats.pending}</h3>
                <p>На проверке</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <h3>{stats.active}</h3>
                <p>Активные</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <h3>{stats.resolved}</h3>
                <p>Решённые</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <h3>{stats.rejected}</h3>
                <p>Отклонённые</p>
              </div>
            </div>
          </div>

          <div className="recent-marks">
            <div className="section-header">
              <h2>{profileTab === "favorites" ? "Избранное" : "Мои обращения"}</h2>
              <Link to="/" className="view-all">
                На карту →
              </Link>
            </div>

            <div className="profile-filters" role="tablist" aria-label="Раздел профиля">
              <button
                type="button"
                role="tab"
                aria-selected={profileTab === "markers"}
                className={`profile-filter-chip${profileTab === "markers" ? " profile-filter-chip--on" : ""}`}
                onClick={() => setProfileTab("markers")}
              >
                Мои обращения
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={profileTab === "favorites"}
                className={`profile-filter-chip${profileTab === "favorites" ? " profile-filter-chip--on" : ""}`}
                onClick={() => setProfileTab("favorites")}
              >
                Избранное
              </button>
            </div>

            {profileTab === "favorites" ? (
              <ProfileFavorites
                onViewMarker={(id) => history.push(`/?marker=${id}`)}
              />
            ) : null}

            {profileTab === "markers" ? (
            <>
            <div className="profile-filters" role="tablist" aria-label="Фильтр обращений">
              {PROFILE_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === f.key}
                  className={`profile-filter-chip${statusFilter === f.key ? " profile-filter-chip--on" : ""}`}
                  onClick={() => setStatusFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {filteredMarkers.length === 0 ? (
              <div className="empty-state">
                <p>Нет обращений в этой категории.</p>
                <Link to="/" className="add-first-btn">
                  Добавить проблему на карте
                </Link>
              </div>
            ) : (
              <div className="marks-list" role="tabpanel">
                {filteredMarkers.map((marker) => {
                  const st = marker.status || "pending";
                  const icon =
                    st === "pending" ? (
                      <IconRowPending size={22} />
                    ) : st === "rejected" ? (
                      <IconRowRejected size={22} />
                    ) : (
                      <IconRowOk size={22} />
                    );
                  const canDelete =
                    st === "pending" || st === "rejected";
                  return (
                    <div key={marker.id} className="mark-item" data-status={st}>
                      <div className="mark-status" data-status={st}>
                        {icon}
                      </div>
                      <div className="mark-content">
                        <h4>
                          {marker.text?.substring(0, 80)}
                          {marker.text?.length > 80 ? "…" : ""}
                        </h4>
                        <span className="mark-status-pill">
                          {statusLabel(st)}
                        </span>
                        {formatDueLine(marker) ? (
                          <p
                            className={`profile-due-line${marker.is_overdue ? " profile-due-line--overdue" : ""}`}
                          >
                            {formatDueLine(marker)}
                          </p>
                        ) : null}
                        {st === "rejected" && marker.moderator_note ? (
                          <p className="profile-mod-note">
                            Причина отклонения: {marker.moderator_note}
                          </p>
                        ) : null}
                        <div className="mark-meta">
                          <span className="mark-date">
                            {formatDate(marker.created_at)}
                          </span>
                        </div>
                      </div>
                      <div className="mark-actions">
                        <button
                          type="button"
                          className="view-btn"
                          onClick={() => handleViewMarker(marker.id)}
                        >
                          На карте
                        </button>
                        {st === "pending" ? (
                          <button
                            type="button"
                            className="view-btn"
                            onClick={() => {
                              setEditMarker(marker);
                              setEditText(marker.text || "");
                            }}
                          >
                            Изменить
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button
                            type="button"
                            className="profile-delete-btn"
                            disabled={busyDeleteId === marker.id}
                            onClick={() => handleDelete(marker)}
                          >
                            Удалить
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </>
            ) : null}
          </div>

          <PasswordSettingsBlock />

          <div className="profile-actions">
            <Link to="/" className="action-btn primary">
              Добавить новую проблему
            </Link>
          </div>
        </div>
      </div>

      {editMarker ? (
        <div
          className="profile-edit-overlay"
          role="presentation"
          onClick={() => setEditMarker(null)}
        >
          <div
            className="profile-edit-dialog"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Редактировать обращение</h3>
            <textarea
              rows={5}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="profile-edit-textarea"
            />
            <div className="profile-edit-actions">
              <button type="button" onClick={() => setEditMarker(null)}>
                Отмена
              </button>
              <button
                type="button"
                className="action-btn primary"
                disabled={editBusy || !editText.trim()}
                onClick={handleSaveEdit}
              >
                {editBusy ? "Сохранение…" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

function ProfileMessengerName({ user, updateUser }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(user?.display_name || "");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const savedName = String(user?.display_name || "").trim();

  useEffect(() => {
    if (!editing) setDraft(user?.display_name || "");
  }, [user?.display_name, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = () => {
    setDraft(user?.display_name || "");
    setEditing(true);
  };

  const cancel = () => {
    setDraft(user?.display_name || "");
    setEditing(false);
  };

  const save = async () => {
    const next = draft.trim();
    if (next === savedName) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      const data = await patchMyProfile(next);
      if (data.user) updateUser(data.user);
      setEditing(false);
      showToast(next ? "Имя обновлено" : "Имя удалено", "success");
    } catch (e) {
      showToast(e.message || "Ошибка", "error");
    } finally {
      setBusy(false);
    }
  };

  const emailLine = (
    <p className="profile-msg-email" title={user.email}>
      {user.email}
    </p>
  );

  if (editing) {
    return (
      <div className="profile-msg">
        <div className="profile-msg-edit">
          <input
            ref={inputRef}
            type="text"
            className="profile-msg-input"
            value={draft}
            maxLength={32}
            disabled={busy}
            placeholder="Ваше имя"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") cancel();
            }}
            aria-label="Имя"
          />
          <div className="profile-msg-actions">
            <button
              type="button"
              className="profile-msg-action profile-msg-action--ok"
              disabled={busy}
              onClick={save}
              aria-label="Сохранить"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M5 13l4 4L19 7"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="profile-msg-action profile-msg-action--cancel"
              disabled={busy}
              onClick={cancel}
              aria-label="Отмена"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
        {emailLine}
      </div>
    );
  }

  return (
    <div className="profile-msg">
      <div className="profile-msg-view">
        <button type="button" className="profile-msg-name-btn" onClick={startEdit}>
          {savedName ? (
            <span className="profile-msg-name">{savedName}</span>
          ) : (
            <span className="profile-msg-name profile-msg-name--empty">Добавить имя</span>
          )}
        </button>
        <button
          type="button"
          className="profile-msg-pencil"
          onClick={startEdit}
          aria-label="Изменить имя"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 20h4l10.5-10.5a2.12 2.12 0 0 0-3-3L5 17v3z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinejoin="round"
            />
            <path
              d="M13.5 6.5l3 3"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      {emailLine}
    </div>
  );
}

function PasswordSettingsBlock() {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!oldPw || newPw.length < 6) {
      showToast("Укажите текущий пароль и новый (от 6 символов)", "error");
      return;
    }
    setBusy(true);
    try {
      await changePassword(oldPw, newPw);
      setOldPw("");
      setNewPw("");
      showToast("Пароль обновлён", "success");
    } catch (e) {
      showToast(e.message || "Ошибка", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="recent-marks geo-subs-section">
      <div className="section-header">
        <h2>Настройки</h2>
      </div>
      <p className="profile-geo-hint">Смена пароля учётной записи.</p>
      <div className="geo-subs-form password-settings-form">
        <input
          type="password"
          placeholder="Текущий пароль"
          value={oldPw}
          onChange={(e) => setOldPw(e.target.value)}
          autoComplete="current-password"
        />
        <input
          type="password"
          placeholder="Новый пароль"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          autoComplete="new-password"
        />
        <button
          type="button"
          className="action-btn primary"
          disabled={busy}
          onClick={submit}
        >
          {busy ? "Сохранение…" : "Сменить пароль"}
        </button>
      </div>
    </div>
  );
}

export default Profile;
