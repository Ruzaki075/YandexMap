import React, { memo } from "react";
import { SORT_OPTIONS } from "./classificationConstants.js";

function ClassificationToolbar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  count,
  filteredCount,
  onCreate,
  orderMode,
  onOrderModeToggle,
}) {
  return (
    <div className="tax-toolbar">
      <div className="tax-toolbar__row">
        <input
          type="search"
          className="tax-toolbar__search"
          placeholder="Поиск по названию или ключу…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Поиск классификаций"
        />
        <select
          className="tax-toolbar__sort"
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          aria-label="Сортировка"
          disabled={orderMode}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`mod-action mod-action--muted${orderMode ? " tax-toolbar__order-on" : ""}`}
          onClick={onOrderModeToggle}
          title="Перетащите карточки для изменения порядка в фильтрах и списках"
        >
          {orderMode ? "Готово" : "Порядок"}
        </button>
        <button type="button" className="mod-action mod-action--ok" onClick={onCreate}>
          + Новая
        </button>
      </div>
      <p className="tax-toolbar__meta">
        {filteredCount === count
          ? `${count} направлений`
          : `${filteredCount} из ${count}`}
        {orderMode ? " · режим сортировки перетаскиванием" : ""}
      </p>
    </div>
  );
}

export default memo(ClassificationToolbar);
