import React, { memo } from "react";
import { markerPresetLabel } from "../../utils/markerColors.js";
import { presetHex } from "../../utils/classificationColorUtils.js";
import ClassificationStats from "./ClassificationStats.jsx";

function ClassificationCard({
  row,
  onEdit,
  onDelete,
  busy,
  dragHandleProps,
}) {
  const canDelete = (row.markers_count ?? 0) === 0;

  return (
    <article className="tax-card">
      <div className="tax-card__drag" {...dragHandleProps} title="Перетащите для сортировки">
        <span aria-hidden>⋮⋮</span>
      </div>
      <span
        className="tax-marker-preview tax-marker-preview--lg"
        style={{ background: presetHex(row.marker_icon) }}
        title={markerPresetLabel(row.marker_icon)}
        aria-hidden
      />
      <div className="tax-card__body">
        <div className="tax-card__head">
          <h4 className="tax-card__title">{row.label_ru}</h4>
          <code className="tax-card__key">{row.key}</code>
        </div>
        <div className="tax-card__meta">
          <span
            className="tax-sla-badge"
            title="Срок устранения (SLA): максимальное время на решение обращения после одобрения"
          >
            SLA {row.resolution_days ?? 14} дн.
          </span>
          <span className="tax-card__color-name">
            {markerPresetLabel(row.marker_icon)}
          </span>
        </div>
        <ClassificationStats row={row} />
      </div>
      <div className="tax-card__actions">
        <button
          type="button"
          className="mod-action mod-action--muted"
          disabled={busy}
          onClick={() => onEdit(row)}
        >
          Редактировать
        </button>
        <button
          type="button"
          className="mod-action mod-action--bad"
          disabled={busy || !canDelete}
          title={
            canDelete
              ? "Удалить классификацию"
              : `Нельзя удалить: ${row.markers_count} обращений`
          }
          onClick={() => onDelete(row)}
        >
          Удалить
        </button>
      </div>
    </article>
  );
}

export default memo(ClassificationCard);
