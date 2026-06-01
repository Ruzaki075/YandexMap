import React, { useState } from "react";
import { postAbuseReport } from "../../services/api.js";
import { showToast } from "../ToastHost.jsx";
import { IconAlertCircle } from "../Icons.jsx";
import "./MarkerReportForm.css";

const REASONS = [
  { value: "spam", label: "Спам / реклама" },
  { value: "fake", label: "Фейковое обращение" },
  { value: "offensive", label: "Оскорбления" },
  { value: "other", label: "Другое" },
];

/**
 * Форма жалобы на обращение — уходит модераторам во вкладку «Спам».
 */
export default function MarkerReportForm({
  markerId,
  user,
  compact = false,
  onSubmitted,
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user || !markerId) return null;

  const submit = async () => {
    setBusy(true);
    try {
      await postAbuseReport({
        target_type: "marker",
        target_id: markerId,
        reason,
        details: details.trim(),
      });
      setSent(true);
      setOpen(false);
      setDetails("");
      showToast("Жалоба отправлена модераторам", "success");
      window.dispatchEvent(new Event("yandexmap:notifications"));
      onSubmitted?.();
    } catch (e) {
      showToast(e.message || "Не удалось отправить жалобу", "error");
    } finally {
      setBusy(false);
    }
  };

  if (sent && !open) {
    return (
      <p className={`marker-report${compact ? " marker-report--compact" : ""}`}>
        <IconAlertCircle size={16} />
        Жалоба принята — модератор рассмотрит её во вкладке «Спам»
      </p>
    );
  }

  return (
    <div className={`marker-report${compact ? " marker-report--compact" : ""}`}>
      <button
        type="button"
        className="marker-report__toggle"
        onClick={() => setOpen((v) => !v)}
      >
        <IconAlertCircle size={16} />
        {open ? "Скрыть форму жалобы" : "Пожаловаться на обращение"}
      </button>
      {open ? (
        <div className="marker-report__form">
          <p className="marker-report__hint">
            Жалоба попадёт модераторам во вкладку «Спам» на панели модерации.
          </p>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-label="Причина жалобы"
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <textarea
            rows={2}
            placeholder="Подробности (необязательно)"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
          <button
            type="button"
            className="marker-report__submit"
            disabled={busy}
            onClick={submit}
          >
            {busy ? "Отправка…" : "Отправить жалобу"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
