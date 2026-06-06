import React, { memo } from "react";
import { SORT_OPTIONS } from "./moderationConstants.js";

function ModerationSidebar({
  filters,
  setFilters,
  resetFilters,
  domainOptions,
  stats,
}) {
  const toggle = (key) => setFilters({ [key]: !filters[key] });

  return (
    <aside className="mod-v2-sidebar" aria-label="Фильтры модерации">
      <div className="mod-v2-sidebar__block">
        <label className="mod-v2-label" htmlFor="mod-filter-category">
          Категория
        </label>
        <select
          id="mod-filter-category"
          className="mod-v2-select"
          value={filters.category}
          onChange={(e) => setFilters({ category: e.target.value })}
        >
          {domainOptions.map((d) => (
            <option key={d.key || "__all"} value={d.key}>
              {d.label}
              {stats?.by_domain && d.key
                ? ` (${stats.by_domain[d.key] ?? 0})`
                : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="mod-v2-sidebar__block">
        <label className="mod-v2-label" htmlFor="mod-filter-sort">
          Сортировка
        </label>
        <select
          id="mod-filter-sort"
          className="mod-v2-select"
          value={filters.sort}
          onChange={(e) => setFilters({ sort: e.target.value })}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="mod-v2-sidebar__block mod-v2-checks">
        <legend className="mod-v2-label">Условия</legend>
        <label className="mod-v2-check">
          <input
            type="checkbox"
            checked={filters.overdue}
            onChange={() => toggle("overdue")}
          />
          Просроченные
          {stats?.overdue_count != null ? (
            <span className="mod-v2-check__n">{stats.overdue_count}</span>
          ) : null}
        </label>
        <label className="mod-v2-check">
          <input
            type="checkbox"
            checked={filters.unresolved}
            onChange={() => toggle("unresolved")}
          />
          Не закрыты
        </label>
        <label className="mod-v2-check">
          <input
            type="checkbox"
            checked={filters.has_photo}
            onChange={() => toggle("has_photo")}
          />
          С фото
        </label>
        <label className="mod-v2-check">
          <input
            type="checkbox"
            checked={filters.many_supports}
            onChange={() => toggle("many_supports")}
          />
          Много поддержек (3+)
        </label>
        <label className="mod-v2-check">
          <input
            type="checkbox"
            checked={filters.my_checks}
            onChange={() => toggle("my_checks")}
          />
          Мои проверки
        </label>
      </fieldset>

      <div className="mod-v2-sidebar__block mod-v2-dates">
        <label className="mod-v2-label" htmlFor="mod-date-from">
          Дата с
        </label>
        <input
          id="mod-date-from"
          type="date"
          className="mod-v2-input"
          value={filters.date_from}
          onChange={(e) => setFilters({ date_from: e.target.value })}
        />
        <label className="mod-v2-label" htmlFor="mod-date-to">
          Дата по
        </label>
        <input
          id="mod-date-to"
          type="date"
          className="mod-v2-input"
          value={filters.date_to}
          onChange={(e) => setFilters({ date_to: e.target.value })}
        />
      </div>

      <button type="button" className="mod-v2-reset" onClick={resetFilters}>
        Сбросить фильтры
      </button>
    </aside>
  );
}

export default memo(ModerationSidebar);
