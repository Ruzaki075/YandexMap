import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPublicProfile, getUserActivity } from "../../services/api.js";
import { resolveAvatarUrl } from "../../utils/avatarUrl.js";
import PointsBadge from "../Gamification/PointsBadge.jsx";
import "../Profile/Profile.css";
import "./UserPublic.css";

const BADGE_LABELS = {
  activist: "Активист",
  problem_solver: "Решатель проблем",
  reporter: "Репортёр",
};

export default function UserPublic() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [calendar, setCalendar] = useState({});
  const [err, setErr] = useState("");

  useEffect(() => {
    const uid = Number(id);
    if (!uid) return;
    getPublicProfile(uid)
      .then(setProfile)
      .catch((e) => setErr(e.message || "Не найден"));
    getUserActivity(uid)
      .then((d) => setCalendar(d.calendar || {}))
      .catch(() => setCalendar({}));
  }, [id]);

  return (
    <>
      <div className="profile-page page-aurora page-aurora--karta">
        <div className="profile-container user-public">
          {err ? <p className="leaderboard-err">{err}</p> : null}
          {profile ? (
            <>
              <div className="user-public-header">
                {resolveAvatarUrl(profile.avatar_url) ? (
                  <img
                    src={resolveAvatarUrl(profile.avatar_url)}
                    alt=""
                    className="user-public-avatar"
                  />
                ) : (
                  <span className="user-public-avatar user-public-avatar--letter">
                    {(profile.email_masked || "?").charAt(0)}
                  </span>
                )}
                <div>
                  <h1>{profile.display_name || profile.email_masked}</h1>
                  <p className="admin-meta-muted">{profile.bio || "Участник сервиса"}</p>
                  <p className="user-public-stats">
                    ★ {profile.karma_points ?? 0} кармы · {profile.markers_total ?? 0}{" "}
                    обращений · {profile.resolved_count ?? 0} решено
                    {profile.review_avg != null
                      ? ` · ${Number(profile.review_avg).toFixed(1)} ★ отзывов`
                      : ""}
                  </p>
                  <div className="user-public-badges">
                    {(profile.badges || []).map((b) => (
                      <span key={b} className="user-public-badge">
                        {BADGE_LABELS[b] || b}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <PointsBadge userId={Number(id)} />
              <h2 className="section-header">
                <span>Активность</span>
              </h2>
              <div className="activity-calendar" aria-label="Календарь активности">
                {Object.entries(calendar).map(([day, n]) => (
                  <span
                    key={day}
                    className="activity-cell"
                    style={{ opacity: Math.min(1, 0.25 + n * 0.2) }}
                    title={`${day}: ${n}`}
                  />
                ))}
              </div>
              <h2 className="section-header">
                <span>Последние обращения</span>
              </h2>
              <ul className="user-public-markers">
                {(profile.recent_markers || []).map((m) => (
                  <li key={m.id}>
                    <Link to={`/?marker=${m.id}`}>
                      #{m.id} — {m.text?.slice(0, 80)}
                      {m.text?.length > 80 ? "…" : ""}
                    </Link>
                    <span className="mark-status-pill">{m.status}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : !err ? (
            <p className="admin-meta-muted">Загрузка…</p>
          ) : null}
        </div>
      </div>
    </>
  );
}
