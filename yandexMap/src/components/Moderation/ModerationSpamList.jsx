import React, { memo } from "react";
import {
  abuseReasonLabel,
  abuseStatusLabel,
} from "./moderationConstants.js";
import { formatRelativeDate, pluralReports } from "./moderationUtils.js";

function reporterInitial(email) {
  const e = (email || "?").trim();
  return e.charAt(0).toUpperCase();
}

function excerpt(report) {
  const text = (report.marker_text || report.details || "").trim();
  return text || "Без описания";
}

function ModerationSpamList({
  reports,
  focusIndex,
  onSelect,
  loading,
  total,
  page,
  pageSize,
  onPageChange,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="mod-v2-list mod-v2-list--spam" aria-label="Жалобы">
      {!loading && reports.length > 0 ? (
        <div className="mod-v2-spam-list-head">
          <span className="mod-v2-spam-list-head__count">{pluralReports(total)}</span>
          <span className="mod-v2-spam-list-head__hint">выберите для просмотра</span>
        </div>
      ) : null}

      <div className="mod-v2-list__scroll">
        {loading ? (
          <div className="mod-v2-empty mod-v2-empty--inline">
            <span className="mod-v2-empty__spinner" aria-hidden />
            <p className="mod-v2-empty__title">Загружаем жалобы…</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="mod-v2-empty mod-v2-empty--spam">
            <span className="mod-v2-empty__icon" aria-hidden>
              ⚠
            </span>
            <p className="mod-v2-empty__title">Жалоб пока нет</p>
            <p className="mod-v2-empty__hint">
              Пользователи отправляют их из карточки обращения на карте — кнопка
              «Пожаловаться» (нужен вход в аккаунт).
            </p>
          </div>
        ) : (
          <ul className="mod-v2-spam-items">
            {reports.map((r, index) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={`mod-v2-spam-item${
                    focusIndex === index ? " mod-v2-spam-item--on" : ""
                  }`}
                  onClick={() => onSelect(index)}
                >
                  <div className="mod-v2-spam-item__row">
                    <span
                      className={`mod-v2-reason-pill mod-v2-reason-pill--${
                        r.reason || "other"
                      }`}
                    >
                      {abuseReasonLabel(r.reason)}
                    </span>
                    <span
                      className={`mod-v2-badge mod-v2-badge--${r.status || "open"}`}
                    >
                      {abuseStatusLabel(r.status)}
                    </span>
                  </div>
                  <p className="mod-v2-spam-item__text">{excerpt(r)}</p>
                  {r.open_reports_on_target > 1 ? (
                    <p className="mod-v2-spam-item__cluster">
                      {r.open_reports_on_target} жалоб на обращение №{r.target_id}
                    </p>
                  ) : null}
                  <div className="mod-v2-spam-item__foot">
                    <span className="mod-v2-spam-item__who">
                      <span className="mod-v2-spam-item__avatar" aria-hidden>
                        {reporterInitial(r.reporter_email)}
                      </span>
                      <span className="mod-v2-spam-item__email">
                        {r.reporter_email || `user #${r.reporter_user_id}`}
                      </span>
                    </span>
                    <span className="mod-v2-spam-item__id">#{r.id}</span>
                    <time
                      className="mod-v2-spam-item__date"
                      dateTime={r.created_at}
                      title={r.created_at}
                    >
                      {formatRelativeDate(r.created_at)}
                    </time>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {totalPages > 1 ? (
        <div className="mod-v2-pager mod-v2-pager--spam">
          <button
            type="button"
            className="mod-v2-btn mod-v2-btn--ghost"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
            aria-label="Предыдущая страница"
          >
            ←
          </button>
          <span className="mod-v2-pager__label">
            Страница {page} из {totalPages}
          </span>
          <button
            type="button"
            className="mod-v2-btn mod-v2-btn--ghost"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
            aria-label="Следующая страница"
          >
            →
          </button>
        </div>
      ) : null}
    </section>
  );
}

export default memo(ModerationSpamList);
