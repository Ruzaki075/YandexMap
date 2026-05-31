import React, { useEffect, useState } from "react";

import { Link } from "react-router-dom";

import MapHeader from "../Map/MapHeader.jsx";

import { getLeaderboardSeason } from "../../services/api.js";

import { resolveAvatarUrl } from "../../utils/avatarUrl.js";

import "../Profile/Profile.css";

import "./Leaderboard.css";



const PERIODS = [

  { key: "week", label: "Неделя" },

  { key: "month", label: "Месяц" },

  { key: "all", label: "Всё время" },

];



const Leaderboard = () => {

  const [leaders, setLeaders] = useState([]);

  const [loading, setLoading] = useState(true);

  const [err, setErr] = useState("");

  const [period, setPeriod] = useState("week");



  useEffect(() => {

    setLoading(true);

    setErr("");

    getLeaderboardSeason(period)

      .then((d) => setLeaders(d.leaders || []))

      .catch((e) => setErr(e.message || "Ошибка"))

      .finally(() => setLoading(false));

  }, [period]);



  return (

    <>

      <MapHeader />

      <div className="profile-page page-aurora leaderboard-page">

        <div className="profile-container leaderboard-main">

          <div className="section-header">

            <h2>Топ активистов</h2>

            <Link to="/" className="view-all">

              На карту →

            </Link>

          </div>

          <p className="leaderboard-sub">

            Баллы кармы за одобренные и решённые обращения.

          </p>

          <div className="profile-filters leaderboard-periods" role="tablist">

            {PERIODS.map((p) => (

              <button

                key={p.key}

                type="button"

                role="tab"

                aria-selected={period === p.key}

                className={`profile-filter-chip${period === p.key ? " profile-filter-chip--on" : ""}`}

                onClick={() => setPeriod(p.key)}

              >

                {p.label}

              </button>

            ))}

          </div>

          {loading ? <p className="admin-meta-muted">Загрузка…</p> : null}

          {err ? <p className="leaderboard-err">{err}</p> : null}

          {!loading && !err && leaders.length === 0 ? (

            <p className="admin-meta-muted">Пока нет данных.</p>

          ) : null}

          <ol className="leaderboard-list">

            {leaders.map((row, i) => (

              <li key={row.user_id || i} className="leaderboard-item">

                <span className="leaderboard-rank">{i + 1}</span>

                {resolveAvatarUrl(row.avatar_url) ? (

                  <img

                    src={resolveAvatarUrl(row.avatar_url)}

                    alt=""

                    className="leaderboard-avatar"

                    aria-hidden="true"

                  />

                ) : (

                  <span className="leaderboard-avatar leaderboard-avatar--letter">

                    {(row.email || "?").charAt(0).toUpperCase()}

                  </span>

                )}

                {row.user_id ? (

                  <Link

                    to={`/user/${row.user_id}`}

                    className="leaderboard-email leaderboard-email--link"

                  >

                    {row.display_name || row.email || `Пользователь #${row.user_id}`}

                  </Link>

                ) : (

                  <span className="leaderboard-email">

                    {row.email || `Пользователь #${row.user_id}`}

                  </span>

                )}

                <span className="leaderboard-karma">{row.karma_points ?? 0} ★</span>

              </li>

            ))}

          </ol>

        </div>

      </div>

    </>

  );

};



export default Leaderboard;

