import React, { memo } from "react";
import { Link } from "react-router-dom";
import { API_ORIGIN } from "../../config.js";
import {
  abuseReasonLabel,
  abuseStatusLabel,
} from "./moderationConstants.js";
import {
  formatMarkerDate,
  formatRelativeDate,
  STATUS_LABELS,
} from "./moderationUtils.js";

function ModerationSpamPreview({
  report,
  busy,
  onDismiss,
  onActioned,
  onRejectMarker,
}) {
  if (!report) {
    return (
      <section className="mod-v2-preview mod-v2-preview--empty" aria-label="Жалоба">
        <span className="mod-v2-empty__icon mod-v2-empty__icon--muted" aria-hidden>
          ←
        </span>
        <p className="mod-v2-empty__title">Выберите жалобу</p>
        <p className="mod-v2-empty__hint">Слева список — нажмите на строку, чтобы открыть детали</p>
      </section>
    );
  }

  const isMarker = report.target_type === "marker" && report.target_id > 0;
  const img =
    report.marker_image_url &&
    (report.marker_image_url.startsWith("http")
      ? report.marker_image_url
      : `${API_ORIGIN}${report.marker_image_url}`);

  return (
    <section className="mod-v2-preview mod-v2-preview--spam" aria-label="Просмотр жалобы">
      <header className="mod-v2-preview__head">
        <div>
          <h2 className="mod-v2-preview__title">Жалоба #{report.id}</h2>
          <div className="mod-v2-preview__badges">
            <span
              className={`mod-v2-reason-pill mod-v2-reason-pill--${
                report.reason || "other"
              } mod-v2-reason-pill--lg`}
            >
              {abuseReasonLabel(report.reason)}
            </span>
            <span className={`mod-v2-badge mod-v2-badge--${report.status}`}>
              {abuseStatusLabel(report.status)}
            </span>
            <span className="mod-v2-spam-time" title={formatMarkerDate(report.created_at)}>
              {formatRelativeDate(report.created_at)}
            </span>
          </div>
        </div>
        {report.status === "open" ? (
          <div className="mod-v2-preview__actions">
            <button
              type="button"
              className="mod-v2-act"
              disabled={busy}
              onClick={() => onDismiss(report)}
            >
              Без нарушения
            </button>
            {isMarker && onRejectMarker ? (
              <button
                type="button"
                className="mod-v2-act mod-v2-act--bad"
                disabled={busy}
                onClick={() => onRejectMarker(report)}
              >
                Отклонить обращение
              </button>
            ) : null}
            <button
              type="button"
              className="mod-v2-act mod-v2-act--ok"
              disabled={busy}
              onClick={() => onActioned(report)}
            >
              Обработано
            </button>
          </div>
        ) : null}
      </header>

      <div className="mod-v2-preview__scroll">
        <div className="mod-v2-preview__meta">
          <div>
            <span className="mod-v2-meta-lbl">Кто пожаловался</span>
            <span>{report.reporter_email || `user #${report.reporter_user_id}`}</span>
          </div>
          <div>
            <span className="mod-v2-meta-lbl">Дата</span>
            <span>{formatMarkerDate(report.created_at)}</span>
          </div>
        </div>

        {report.details ? (
          <div className="mod-v2-preview__section">
            <h3>Комментарий пользователя</h3>
            <blockquote className="mod-v2-quote">{report.details}</blockquote>
          </div>
        ) : null}

        {isMarker ? (
          <div className="mod-v2-preview__section mod-v2-spam-target">
            <h3>Обращение #{report.target_id}</h3>
            {report.marker_status ? (
              <p className="mod-v2-spam-target__status">
                <span className={`mod-v2-pill mod-v2-pill--${report.marker_status}`}>
                  {STATUS_LABELS[report.marker_status] || report.marker_status}
                </span>
              </p>
            ) : (
              <p className="mod-v2-note mod-v2-note--muted">
                Обращение не найдено или удалено
              </p>
            )}
            {report.marker_text ? (
              <p className="mod-v2-prose mod-v2-prose--compact">{report.marker_text}</p>
            ) : null}
            {img ? (
              <figure className="mod-v2-preview__media">
                <a href={img} target="_blank" rel="noreferrer">
                  <img src={img} alt="Фото обращения" />
                </a>
                <figcaption>Нажмите, чтобы открыть в полном размере</figcaption>
              </figure>
            ) : null}
            <Link
              to={`/?marker=${report.target_id}`}
              className="mod-v2-act mod-v2-act--link mod-v2-spam-map-link"
              target="_blank"
              rel="noreferrer"
            >
              Открыть на карте
            </Link>
          </div>
        ) : (
          <p className="mod-v2-note mod-v2-note--muted">
            Цель жалобы: {report.target_type} #{report.target_id}
          </p>
        )}

        {report.status === "open" ? (
          <div className="mod-v2-spam-help">
            <p>
              <strong>Без нарушения</strong> — закрыть жалобу, обращение не трогаем.
            </p>
            <p>
              <strong>Отклонить обращение</strong> — отклонить метку с причиной, жалоба
              станет обработанной.
            </p>
            <p>
              <strong>Обработано</strong> — жалоба учтена, статус обращения без изменений.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default memo(ModerationSpamPreview);
