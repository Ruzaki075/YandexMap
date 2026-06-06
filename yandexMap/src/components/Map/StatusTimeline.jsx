import React, { useEffect, useState, useMemo } from "react";
import { getMarkerStatusHistory } from "../../services/api.js";
import { STATUS_LABELS } from "../../utils/slaLabels.js";
import {
  IconAlertCircle,
  IconCheck,
  IconSettings,
  IconStar,
  IconX,
} from "../Icons.jsx";
import "./StatusTimeline.css";

const FLOW = [
  { key: "pending", Icon: IconAlertCircle, label: "На проверке" },
  { key: "approved", Icon: IconCheck, label: "Принято" },
  { key: "in_progress", Icon: IconSettings, label: "В работе" },
  { key: "resolved", Icon: IconStar, label: "Решено" },
];

const REJECTED = { key: "rejected", Icon: IconX, label: "Отклонено" };

function formatWhen(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StatusTimeline({ markerId, currentStatus = "pending" }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!markerId) return;
    setLoading(true);
    getMarkerStatusHistory(markerId)
      .then((d) => setHistory(d.history || []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [markerId]);

  const status = (currentStatus || "pending").toLowerCase();
  const isRejected = status === "rejected";

  const reached = useMemo(() => {
    const set = new Set();
    history.forEach((h) => {
      if (h.new_status) set.add(h.new_status);
    });
    set.add(status);
    return set;
  }, [history, status]);

  const steps = isRejected ? [...FLOW.slice(0, 1), REJECTED] : FLOW;

  const noteByStatus = useMemo(() => {
    const map = {};
    history.forEach((h) => {
      if (h.moderator_note) map[h.new_status] = h.moderator_note;
    });
    return map;
  }, [history]);

  const timeByStatus = useMemo(() => {
    const map = {};
    history.forEach((h) => {
      if (!map[h.new_status]) map[h.new_status] = h.created_at;
    });
    return map;
  }, [history]);

  if (loading) {
    return <p className="status-timeline-muted">Загрузка статусов…</p>;
  }

  const currentIdx = steps.findIndex((s) => s.key === status);

  return (
    <ol className="status-timeline" aria-label="Статусы обращения">
      {steps.map((step, idx) => {
        const done = reached.has(step.key);
        const isCurrent = step.key === status;
        const isFuture = !isRejected && currentIdx >= 0 && idx > currentIdx;
        const dim = isFuture && !done;
        const StepIcon = step.Icon;
        return (
          <li
            key={step.key}
            className={`status-timeline-item${done ? " is-done" : ""}${
              isCurrent ? " is-current" : ""
            }${dim ? " is-future" : ""}`}
          >
            <span className="status-timeline-icon" aria-hidden="true">
              <StepIcon size={18} />
            </span>
            <div className="status-timeline-body">
              <strong>{STATUS_LABELS[step.key] || step.label}</strong>
              {timeByStatus[step.key] ? (
                <time className="status-timeline-time">
                  {formatWhen(timeByStatus[step.key])}
                </time>
              ) : isFuture ? (
                <span className="status-timeline-time status-timeline-time--muted">
                  ожидается
                </span>
              ) : null}
              {noteByStatus[step.key] ? (
                <p className="status-timeline-note">{noteByStatus[step.key]}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
