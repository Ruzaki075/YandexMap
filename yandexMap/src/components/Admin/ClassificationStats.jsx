import React, { memo } from "react";
import { formatAvgDays } from "./classificationUtils.js";

function ClassificationStats({ row }) {
  const total = row.markers_count ?? 0;
  const resolved = row.resolved_count ?? 0;
  const pct =
    row.resolved_pct != null
      ? Math.round(row.resolved_pct)
      : total
        ? Math.round((resolved / total) * 100)
        : 0;

  return (
    <div className="tax-stats">
      <span className="tax-stat" title="Всего обращений">
        <strong>{total}</strong>
        <span>обращ.</span>
      </span>
      <span className="tax-stat tax-stat--ok" title="Доля решённых">
        <strong>{pct}%</strong>
        <span>решено</span>
      </span>
      {(row.overdue_count ?? 0) > 0 ? (
        <span className="tax-stat tax-stat--warn" title="Просрочено">
          <strong>{row.overdue_count}</strong>
          <span>проср.</span>
        </span>
      ) : (
        <span className="tax-stat tax-stat--muted" title="Просрочено">
          <strong>0</strong>
          <span>проср.</span>
        </span>
      )}
      <span
        className="tax-stat tax-stat--muted"
        title="Среднее время до решения"
      >
        <strong>{formatAvgDays(row.avg_resolution_days)}</strong>
        <span>ср. срок</span>
      </span>
    </div>
  );
}

export default memo(ClassificationStats);
