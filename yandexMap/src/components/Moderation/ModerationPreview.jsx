import React, { memo, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_ORIGIN } from "../../config.js";
import {
  getMarkerSupports,
  listMarkerReviews,
} from "../../services/api.js";
import {
  findCategoryLabels,
  formatCategoryLine,
} from "../../utils/issueLabels.js";
import { MarkerTimelineFull } from "../Map/MarkerModalExtras.jsx";
import {
  formatMarkerDate,
  formatReviewShort,
  normStatus,
  slaCountdown,
  staticMapUrl,
  STATUS_LABELS,
} from "./moderationUtils.js";

function ModerationPreview({
  marker,
  taxonomy,
  busy,
  onApprove,
  onReject,
  onInProgress,
  onResolved,
}) {
  const [supports, setSupports] = useState({ count: 0, loading: true });
  const [reviews, setReviews] = useState({ list: [], loading: true });

  useEffect(() => {
    if (!marker?.id) return undefined;
    let cancelled = false;
    setSupports({ count: 0, loading: true });
    setReviews({ list: [], loading: true });
    (async () => {
      try {
        const [sup, rev] = await Promise.all([
          getMarkerSupports(marker.id),
          listMarkerReviews(marker.id, { limit: 5 }),
        ]);
        if (!cancelled) {
          setSupports({
            count: sup.count ?? sup.supports?.length ?? 0,
            loading: false,
          });
          setReviews({
            list: rev.reviews || [],
            loading: false,
          });
        }
      } catch {
        if (!cancelled) {
          setSupports({ count: marker.support_count ?? 0, loading: false });
          setReviews({ list: [], loading: false });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [marker?.id, marker?.support_count]);

  if (!marker) {
    return (
      <section className="mod-v2-preview mod-v2-preview--empty" aria-label="Просмотр">
        <p>Выберите обращение в списке</p>
      </section>
    );
  }

  const st = normStatus(marker);
  const sla = slaCountdown(marker);
  const catLine = formatCategoryLine(
    findCategoryLabels(taxonomy, marker.domain_key)
  );

  return (
    <section className="mod-v2-preview" aria-label="Просмотр обращения">
      <header className="mod-v2-preview__head">
        <div>
          <h2 className="mod-v2-preview__title">#{marker.id}</h2>
          <div className="mod-v2-preview__badges">
            <span className={`mod-v2-pill mod-v2-pill--${st}`}>
              {STATUS_LABELS[st]}
            </span>
            <span
              className={`mod-v2-sla${sla.overdue ? " mod-v2-sla--bad" : ""}`}
            >
              {sla.text}
            </span>
          </div>
        </div>
        <div className="mod-v2-preview__actions">
          {st !== "approved" && st !== "resolved" && (
            <button
              type="button"
              className="mod-v2-act mod-v2-act--ok"
              disabled={busy}
              title="A"
              onClick={() => onApprove(marker)}
            >
              Одобрить
            </button>
          )}
          {st !== "rejected" && (
            <button
              type="button"
              className="mod-v2-act mod-v2-act--bad"
              disabled={busy}
              title="R"
              onClick={() => onReject(marker)}
            >
              Отклонить
            </button>
          )}
          {["approved", "pending"].includes(st) && (
            <button
              type="button"
              className="mod-v2-act"
              disabled={busy}
              title="I"
              onClick={() => onInProgress(marker)}
            >
              В работу
            </button>
          )}
          {["approved", "in_progress"].includes(st) && st !== "resolved" && (
            <button
              type="button"
              className="mod-v2-act mod-v2-act--ok"
              disabled={busy}
              title="X"
              onClick={() => onResolved(marker)}
            >
              Решено
            </button>
          )}
          <Link
            to={`/?marker=${marker.id}`}
            className="mod-v2-act mod-v2-act--link"
            target="_blank"
            rel="noreferrer"
          >
            Карта
          </Link>
        </div>
      </header>

      <div className="mod-v2-preview__scroll">
        {catLine ? (
          <p className="mod-v2-preview__chip">{catLine}</p>
        ) : null}

        <div className="mod-v2-preview__meta">
          <div>
            <span className="mod-v2-meta-lbl">Автор</span>
            <span>{marker.user_email || "—"}</span>
          </div>
          <div>
            <span className="mod-v2-meta-lbl">Создано</span>
            <span>{formatMarkerDate(marker.created_at)}</span>
          </div>
          {formatReviewShort(marker) ? (
            <div>
              <span className="mod-v2-meta-lbl">Отзывы</span>
              <span>{formatReviewShort(marker)}</span>
            </div>
          ) : null}
          <div>
            <span className="mod-v2-meta-lbl">Поддержки</span>
            <span>
              {supports.loading ? "…" : supports.count}
            </span>
          </div>
        </div>

        {st === "rejected" && marker.moderator_note ? (
          <p className="mod-v2-note">
            <strong>Отклонение:</strong> {marker.moderator_note}
          </p>
        ) : null}

        <div className="mod-v2-preview__section">
          <h3>Описание</h3>
          <p className="mod-v2-prose">{marker.text || "—"}</p>
        </div>

        {(marker.image_url || marker.latitude != null) && (
          <div className="mod-v2-preview__media">
            {marker.image_url ? (
              <figure>
                <img
                  src={`${API_ORIGIN}${marker.image_url}`}
                  alt=""
                  loading="lazy"
                />
              </figure>
            ) : null}
            {marker.latitude != null && (
              <figure>
                <img
                  src={staticMapUrl(marker.latitude, marker.longitude)}
                  alt="Место на карте"
                  loading="lazy"
                />
                <figcaption>
                  {marker.address_text ||
                    `${marker.latitude?.toFixed(5)}, ${marker.longitude?.toFixed(5)}`}
                </figcaption>
              </figure>
            )}
          </div>
        )}

        {!reviews.loading && reviews.list.length > 0 ? (
          <div className="mod-v2-preview__section">
            <h3>Отзывы</h3>
            <ul className="mod-v2-mini-list">
              {reviews.list.map((r) => (
                <li key={r.id}>
                  <strong>{r.user_email || "—"}</strong> — {"★".repeat(r.rating)}
                  {r.comment ? <p>{r.comment}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mod-v2-preview__section">
          <h3>История</h3>
          <MarkerTimelineFull markerId={marker.id} />
        </div>
      </div>
    </section>
  );
}

export default memo(ModerationPreview);
