import React, { useEffect, useState } from "react";
import { getAdminAuditLog } from "../../services/api.js";

export default function AdminAuditLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    getAdminAuditLog(80)
      .then((d) => setEntries(d.entries || []))
      .catch((e) => setErr(e.message || "Ошибка"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="admin-meta-muted">Загрузка журнала…</p>;
  if (err) return <div className="mod-alert">{err}</div>;
  if (!entries.length) {
    return <p className="admin-meta-muted">Записей пока нет.</p>;
  }

  return (
    <ul className="admin-audit-list">
      {entries.map((e) => (
        <li key={e.id} className="admin-audit-item">
          <time className="admin-audit-time">
            {new Date(e.created_at).toLocaleString("ru-RU")}
          </time>
          <strong>{e.action}</strong>
          <span className="admin-meta-muted">
            {" "}
            {e.target_type}
            {e.target_id != null ? ` #${e.target_id}` : ""}
            {e.actor_email ? ` · ${e.actor_email}` : ""}
          </span>
          {e.details && Object.keys(e.details).length > 0 ? (
            <pre className="admin-audit-details">
              {JSON.stringify(e.details, null, 2)}
            </pre>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
