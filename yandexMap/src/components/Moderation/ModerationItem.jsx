import React, { memo } from "react";
import {
  findCategoryLabels,
  formatCategoryLine,
} from "../../utils/issueLabels.js";
import { normStatus, slaCountdown, STATUS_LABELS } from "./moderationUtils.js";

function ModerationItem({
  marker,
  index,
  style,
  taxonomy,
  isActive,
  isSelected,
  onSelect,
  onToggleCheck,
}) {
  const st = normStatus(marker);
  const sla = slaCountdown(marker);
  const cat = findCategoryLabels(taxonomy, marker.domain_key);
  const catLine = formatCategoryLine(cat);

  return (
    <article
      style={style}
      className={`mod-v2-item${isActive ? " mod-v2-item--active" : ""}${
        isSelected ? " mod-v2-item--sel" : ""
      }`}
      role="option"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      onClick={() => onSelect(index)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(index);
        }
      }}
    >
      <span
        className="mod-v2-item__check"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleCheck(marker.id)}
          aria-label={`Выбрать #${marker.id}`}
        />
      </span>
      <div className="mod-v2-item__body">
        <div className="mod-v2-item__head">
          <span className="mod-v2-item__id">#{marker.id}</span>
          <span className={`mod-v2-pill mod-v2-pill--${st}`}>
            {STATUS_LABELS[st] || st}
          </span>
          <span
            className={`mod-v2-sla${sla.overdue ? " mod-v2-sla--bad" : ""}`}
          >
            {sla.text}
          </span>
        </div>
        {catLine ? <span className="mod-v2-item__cat">{catLine}</span> : null}
        <p className="mod-v2-item__text">{marker.text || "Без описания"}</p>
        <span className="mod-v2-item__meta">
          ♥ {marker.support_count ?? 0}
          {marker.image_url ? " · фото" : ""}
        </span>
      </div>
    </article>
  );
}

export default memo(ModerationItem);
