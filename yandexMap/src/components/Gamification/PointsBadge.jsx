import React, { useEffect, useState } from "react";
import {
  getProfilePoints,
  getProfileAchievements,
  getUserAchievements,
} from "../../services/api.js";
import { IconStar } from "../Icons.jsx";
import "./PointsBadge.css";

export default function PointsBadge({ userId = null, compact = false }) {
  const [points, setPoints] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [err, setErr] = useState("");

  const isSelf = userId == null;

  useEffect(() => {
    let cancelled = false;
    setErr("");
    const load = async () => {
      try {
        if (isSelf) {
          const [p, a] = await Promise.all([
            getProfilePoints(15),
            getProfileAchievements(),
          ]);
          if (!cancelled) {
            setPoints(p);
            setAchievements(a.achievements || []);
          }
        } else {
          const a = await getUserAchievements(userId);
          if (!cancelled) {
            setPoints(null);
            setAchievements(a.achievements || []);
          }
        }
      } catch (e) {
        if (!cancelled) setErr(e.message || "Ошибка");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userId, isSelf]);

  if (err && isSelf) {
    return <p className="points-badge-err">{err}</p>;
  }

  const earned = achievements.filter((a) => a.earned);
  const totalPts = points?.points ?? 0;
  const levelName = points?.level_name || "Житель";
  const level = points?.level ?? 1;
  const toNext = points?.points_to_next ?? 0;
  const span = points?.current_level_span ?? 200;
  const progress =
    span > 0 ? Math.min(100, Math.round(((span - toNext) / span) * 100)) : 100;

  if (compact && isSelf && points) {
    return (
      <div className="points-badge points-badge--compact">
        <span className="points-badge-level">Ур. {level}</span>
        <span className="points-badge-name">{levelName}</span>
        <span className="points-badge-pts">
          <IconStar size={14} /> {totalPts}
        </span>
      </div>
    );
  }

  return (
    <section className="points-badge" aria-label="Баллы и достижения">
      {isSelf && points ? (
        <div className="points-badge-summary">
          <div className="points-badge-head">
            <span className="points-badge-level-pill">Уровень {level}</span>
            <h3 className="points-badge-title">{levelName}</h3>
            <p className="points-badge-score">
              <strong>{totalPts}</strong> баллов
              {points.login_streak > 0 ? (
                <span className="points-badge-streak">
                  {" "}
                  · 🔥 {points.login_streak} дн.
                </span>
              ) : null}
            </p>
          </div>
          {toNext > 0 ? (
            <div className="points-badge-progress-wrap">
              <div className="points-badge-progress">
                <div
                  className="points-badge-progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="points-badge-progress-label">
                До следующего уровня: {toNext} баллов
              </p>
            </div>
          ) : (
            <p className="points-badge-progress-label">Максимальный уровень!</p>
          )}
        </div>
      ) : null}

      {achievements.length > 0 ? (
        <>
          <h4 className="points-badge-ach-title">
            Достижения {earned.length}/{achievements.length}
          </h4>
          <ul className="points-badge-ach-grid">
            {achievements.map((a) => (
              <li
                key={a.key || a.id}
                className={`points-badge-ach${a.earned ? " is-earned" : ""}`}
                title={a.description_ru || a.name_ru}
              >
                <span className="points-badge-ach-icon" aria-hidden="true">
                  {a.icon || "🏅"}
                </span>
                <span className="points-badge-ach-name">{a.name_ru}</span>
                {a.earned && a.points_reward ? (
                  <span className="points-badge-ach-reward">+{a.points_reward}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
