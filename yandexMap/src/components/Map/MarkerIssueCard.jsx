import React, { useState } from "react";
import { API_ORIGIN } from "../../config.js";
import { IconHeart } from "../Icons.jsx";
import { AG_STATUS_LABELS } from "../../utils/slaLabels.js";
import { formatCategoryLine } from "../../utils/issueLabels.js";
import {
  authorInitials,
  authorName,
  avatarColor,
  likeWord,
  splitMarkerAddress,
  formatPublishedLine,
} from "../../utils/mainPageUtils.js";
import {
  MarkerModalToolbar,
  MarkerBeforeAfter,
} from "./MarkerModalExtras.jsx";
import MarkerReportForm from "./MarkerReportForm.jsx";
import "./MarkerIssueCard.css";

/**
 * Карточка обращения в стиле «Активного гражданина».
 */
export default function MarkerIssueCard({
  marker,
  addressFull = "",
  categoryLabels,
  supportBlock,
  user,
  isOwnMarker,
  onToggleLike,
  onShare,
  onMarkerUpdated,
  children,
}) {
  const [detailsOpen, setDetailsOpen] = useState(true);

  const fullAddr =
    addressFull?.trim() ||
    marker?.address_text?.trim() ||
    "";
  const { line1, line2 } = splitMarkerAddress(fullAddr);
  const statusKey = marker?.status || "pending";
  const statusLabel =
    AG_STATUS_LABELS[statusKey] || statusKey;
  const categoryLine =
    formatCategoryLine(categoryLabels) || "Категория не указана";
  const description = marker?.text?.trim() || "Без описания";
  const hasSinglePhoto =
    marker?.image_url && !marker?.image_after_url;
  const hasAnyPhoto =
    marker?.image_url || marker?.image_after_url;

  return (
    <article className="ag-issue-card">
      <header className="ag-issue-head">
        <div className="ag-issue-address">
          <h2 id="map-sheet-title" className="ag-issue-street">
            {line1}
          </h2>
          {line2 ? <p className="ag-issue-area">{line2}</p> : null}
        </div>
        <MarkerModalToolbar
          marker={marker}
          user={user}
          onShare={onShare}
        />
      </header>

      <div className="ag-issue-author">
        <span
          className="ag-issue-avatar"
          style={{ background: avatarColor(marker.user_id) }}
          aria-hidden
        >
          {authorInitials(marker)}
        </span>
        <div className="ag-issue-author-text">
          <p className="ag-issue-author-name">{authorName(marker)}</p>
          <p className="ag-issue-published">{formatPublishedLine(marker)}</p>
        </div>
      </div>

      <p
        className={`ag-issue-status ag-issue-status--${statusKey}`}
        role="status"
      >
        {statusLabel}
      </p>

      <p className="ag-issue-category">{categoryLine}</p>

      <section className="ag-issue-likes ag-issue-likes--prominent" aria-label="Лайки">
        <button
          type="button"
          className={`ag-issue-like-btn${
            supportBlock.iSupported ? " ag-issue-like-btn--on" : ""
          }`}
          disabled={
            supportBlock.saving || supportBlock.loading || isOwnMarker
          }
          aria-pressed={supportBlock.iSupported}
          onClick={onToggleLike}
        >
          <IconHeart size={20} filled={supportBlock.iSupported} />
          <span className="ag-issue-like-count">
            {supportBlock.loading
              ? "…"
              : supportBlock.count || 0}
          </span>
          <span className="ag-issue-like-label">
            {supportBlock.loading
              ? ""
              : likeWord(supportBlock.count || 0)}
          </span>
        </button>
        <p className="ag-issue-likes-hint">
          {!user
            ? "Войдите, чтобы поставить лайк"
            : isOwnMarker
              ? "Своё обращение"
              : supportBlock.iSupported
                ? "Вы поддержали обращение"
                : "Поддержите, если столкнулись с проблемой"}
        </p>
      </section>

      {!isOwnMarker ? (
        <MarkerReportForm markerId={marker?.id} user={user} />
      ) : null}

      {hasAnyPhoto ? (
        <div className="ag-issue-photo-wrap">
          {hasSinglePhoto ? (
            <img
              src={`${API_ORIGIN}${marker.image_url}`}
              alt=""
              className="ag-issue-photo"
              decoding="async"
            />
          ) : (
            <MarkerBeforeAfter
              marker={marker}
              user={user}
              onUpdated={onMarkerUpdated}
            />
          )}
        </div>
      ) : null}

      <button
        type="button"
        className="ag-issue-details-toggle"
        aria-expanded={detailsOpen}
        onClick={() => setDetailsOpen((v) => !v)}
      >
        {detailsOpen ? "Скрыть детали" : "Показать детали"}
      </button>

      <p className="ag-issue-description">{description}</p>

      {detailsOpen ? (
        <div className="ag-issue-details">{children}</div>
      ) : null}
    </article>
  );
}
