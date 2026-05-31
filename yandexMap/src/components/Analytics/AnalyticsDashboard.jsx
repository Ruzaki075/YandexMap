import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import MapHeader from "../Map/MapHeader.jsx";
import { getAnalyticsDashboard } from "../../services/api.js";
import "../Profile/Profile.css";
import "./AnalyticsDashboard.css";

export default function AnalyticsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAnalyticsDashboard(30)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const maxDay = Math.max(1, ...(data?.by_day || []).map((d) => d.count));

  return (
    <>
      <MapHeader />
      <div className="profile-page page-aurora">
        <div className="profile-container analytics-page">
          <div className="section-header">
            <h2>Аналитика</h2>
            <Link to="/stats" className="view-all">
              Сводка →
            </Link>
          </div>
          {loading ? (
            <p className="admin-meta-muted">Загрузка…</p>
          ) : !data ? (
            <p className="admin-meta-muted">Нет данных</p>
          ) : (
            <>
              <div className="analytics-kpis">
                <div className="analytics-kpi">
                  <span className="analytics-kpi__n">{data.total}</span>
                  <span>Всего</span>
                </div>
                <div className="analytics-kpi">
                  <span className="analytics-kpi__n">{data.active}</span>
                  <span>Активные</span>
                </div>
                <div className="analytics-kpi">
                  <span className="analytics-kpi__n">{data.resolved}</span>
                  <span>Решённые</span>
                </div>
                <div className="analytics-kpi analytics-kpi--warn">
                  <span className="analytics-kpi__n">{data.overdue}</span>
                  <span>Просрочено</span>
                </div>
              </div>
              <h3>Обращения по дням (30 дн.)</h3>
              <div className="analytics-bars">
                {(data.by_day || []).map((d) => (
                  <div key={d.day} className="analytics-bar-wrap" title={`${d.day}: ${d.count}`}>
                    <div
                      className="analytics-bar"
                      style={{ height: `${(d.count / maxDay) * 100}%` }}
                    />
                    <span className="analytics-bar-label">{d.day.slice(5)}</span>
                  </div>
                ))}
              </div>
              <h3>По категориям</h3>
              <ul className="analytics-cats">
                {(data.by_category || []).map((c) => (
                  <li key={c.domain_key}>
                    <span>{c.label || c.domain_key}</span>
                    <strong>{c.count}</strong>
                  </li>
                ))}
              </ul>
              <p className="admin-meta-muted">
                SLA: в срок {data.sla?.on_time ?? 0}, с опозданием {data.sla?.late ?? 0}
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
