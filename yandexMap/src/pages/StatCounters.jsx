import React from "react";
import { useCountUp } from "../hooks/useCountUp.js";
import { useInViewOnce } from "../hooks/useInViewOnce.js";
import {
  IconActivity,
  IconCheck,
  IconSettings,
  IconUser,
} from "../components/Icons.jsx";

const ITEMS = [
  { key: "total", label: "Всего обращений", Icon: IconActivity },
  { key: "resolved", label: "Решено", Icon: IconCheck },
  { key: "active", label: "В работе", Icon: IconSettings },
  { key: "participants", label: "Участников", Icon: IconUser },
];

/** Четыре счётчика статистики с анимацией при появлении. */
export default function StatCounters({ stats, className = "" }) {
  const [ref, inView] = useInViewOnce({ threshold: 0.2 });
  const total = useCountUp(stats?.total ?? 0, inView);
  const resolved = useCountUp(stats?.resolved ?? 0, inView);
  const active = useCountUp(stats?.active ?? 0, inView);
  const participants = useCountUp(stats?.participants ?? 0, inView);

  const values = { total, resolved, active, participants };

  return (
    <div ref={ref} className={`results-stats-row ${className}`.trim()}>
      {ITEMS.map(({ key, label, Icon }) => (
        <article key={key} className="results-stat-card">
          <span className="results-stat-card__icon" aria-hidden="true">
            <Icon size={22} />
          </span>
          <p className="results-stat-card__value">{values[key]}</p>
          <p className="results-stat-card__label">{label}</p>
        </article>
      ))}
    </div>
  );
}
