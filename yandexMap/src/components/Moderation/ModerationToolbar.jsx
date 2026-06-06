import React, { memo } from "react";
import { Link } from "react-router-dom";
import {
  ABUSE_REASON_LABELS,
  ABUSE_STATUS_OPTIONS,
  MOD_TABS,
  STATUS_OPTIONS,
} from "./moderationConstants.js";

function ModerationToolbar({
  filters,
  setFilters,
  searchInput,
  onSearchInput,
  onSearchSubmit,
  stats,
  loading,
  onRefresh,
  selectedCount,
  onBulkApprove,
  onBulkReject,
  onClearSelection,
  bulkBusy,
}) {
  const isSpam = filters.tab === "spam";
  const openAbuse = stats?.abuse_by_status?.open ?? stats?.abuse_open_count ?? 0;

  return (
    <header className="mod-v2-toolbar" role="toolbar" aria-label="Панель модерации">
      <div className="mod-v2-toolbar__top">
        <div>
          <h1 className="mod-v2-title">Модерация</h1>
          <p className="mod-v2-sub">
            {isSpam
              ? openAbuse > 0
                ? `${openAbuse} новых жалоб ждут решения`
                : "Все жалобы разобраны — отличная работа"
              : `${stats?.by_status?.pending ?? "—"} в очереди · A одобрить · R отклонить · I в работу`}
          </p>
        </div>
        <div className="mod-v2-toolbar__links">
          <button
            type="button"
            className="mod-v2-btn mod-v2-btn--ghost"
            onClick={onRefresh}
            disabled={loading}
          >
            Обновить
          </button>
          <Link to="/admin" className="mod-v2-btn mod-v2-btn--ghost">
            Админ
          </Link>
          <Link to="/" className="mod-v2-btn mod-v2-btn--ghost">
            Карта
          </Link>
        </div>
      </div>

      <div
        className="mod-v2-segments mod-v2-segments--main"
        role="tablist"
        aria-label="Раздел"
      >
        {MOD_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={filters.tab === t.value}
            className={`mod-v2-seg mod-v2-seg--main${
              filters.tab === t.value ? " mod-v2-seg--on" : ""
            }`}
            onClick={() => setFilters({ tab: t.value, page: 1 })}
          >
            {t.label}
            {t.value === "spam" && openAbuse > 0 ? (
              <span className="mod-v2-seg__n mod-v2-seg__n--warn">{openAbuse}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="mod-v2-toolbar__row">
        {isSpam ? (
          <>
            <div
              className="mod-v2-segments"
              role="tablist"
              aria-label="Статус жалобы"
            >
              {ABUSE_STATUS_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="tab"
                  aria-selected={filters.spam_status === o.value}
                  className={`mod-v2-seg${
                    filters.spam_status === o.value ? " mod-v2-seg--on" : ""
                  }`}
                  onClick={() => setFilters({ spam_status: o.value })}
                >
                  {o.label}
                  {stats?.abuse_by_status?.[o.value] != null ? (
                    <span className="mod-v2-seg__n">
                      {stats.abuse_by_status[o.value]}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            <select
              className="mod-v2-select mod-v2-select--inline"
              value={filters.spam_reason}
              aria-label="Причина жалобы"
              onChange={(e) => setFilters({ spam_reason: e.target.value })}
            >
              <option value="">Все причины</option>
              {Object.entries(ABUSE_REASON_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <div
              className="mod-v2-segments"
              role="tablist"
              aria-label="Статус"
            >
              {STATUS_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="tab"
                  aria-selected={
                    !filters.overdue && filters.status === o.value
                  }
                  className={`mod-v2-seg${
                    !filters.overdue && filters.status === o.value
                      ? " mod-v2-seg--on"
                      : ""
                  }`}
                  onClick={() =>
                    setFilters({ status: o.value, overdue: false })
                  }
                >
                  {o.label}
                  {stats?.by_status?.[o.value] != null ? (
                    <span className="mod-v2-seg__n">
                      {stats.by_status[o.value]}
                    </span>
                  ) : null}
                </button>
              ))}
              <button
                type="button"
                role="tab"
                aria-selected={filters.overdue}
                className={`mod-v2-seg mod-v2-seg--warn${
                  filters.overdue ? " mod-v2-seg--on" : ""
                }`}
                onClick={() =>
                  setFilters({
                    overdue: !filters.overdue,
                    status: filters.overdue ? "pending" : filters.status,
                  })
                }
              >
                Просрочка
              </button>
            </div>

            <form
              className="mod-v2-search"
              onSubmit={(e) => {
                e.preventDefault();
                onSearchSubmit();
              }}
            >
              <input
                type="search"
                className="mod-v2-search__input"
                placeholder="Поиск по тексту и адресу…"
                value={searchInput}
                onChange={(e) => onSearchInput(e.target.value)}
                aria-label="Поиск обращений"
              />
            </form>
          </>
        )}
      </div>

      {!isSpam && selectedCount > 0 ? (
        <div className="mod-v2-bulk">
          <span>Выбрано: {selectedCount}</span>
          <button
            type="button"
            className="mod-v2-btn mod-v2-btn--ok"
            disabled={bulkBusy}
            onClick={onBulkApprove}
          >
            Принять
          </button>
          <button
            type="button"
            className="mod-v2-btn mod-v2-btn--bad"
            disabled={bulkBusy}
            onClick={onBulkReject}
          >
            Отклонить…
          </button>
          <button
            type="button"
            className="mod-v2-btn mod-v2-btn--ghost"
            onClick={onClearSelection}
          >
            Снять
          </button>
        </div>
      ) : null}
    </header>
  );
}

export default memo(ModerationToolbar);
