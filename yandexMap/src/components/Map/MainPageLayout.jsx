import React, { useContext } from "react";
import { AuthContext } from "../Auth/AuthContext.jsx";
import {
  CategoryIcon,
  IconCheck,
  IconGrid,
  IconLayers,
  IconList,
  IconMenu,
  IconSearch,
  IconSettings,
  IconX,
} from "../Icons.jsx";
import { CATEGORY_UI } from "../../utils/mainPageUtils.js";
import MainPageMarkerList from "./MainPageMarkerList.jsx";
import styles from "../../styles/MainPage.module.css";

const STATUS_KEYS = ["pending", "approved", "in_progress", "resolved", "rejected"];

const MAP_LAYER_OPTS = [
  { key: "active", label: "Активные" },
  { key: "resolved", label: "Решённые" },
  { key: "all", label: "Все" },
];

/**
 * Каркас главной (без шапки — она в AppHeader): stats + sidebar + карта + список.
 */
export default function MainPageLayout({
  children,
  taxonomy,
  mapDomainFilter,
  setMapDomainFilter,
  categoryCounts,
  mapSearch,
  setMapSearch,
  searchLoading,
  mapStats,
  inProgressCount,
  statusChecks,
  onStatusCheckChange,
  onStatusCheckAll,
  paginatedMarkers,
  filteredTotal,
  page,
  onPageChange,
  totalPages,
  onFocusMarker,
  onReportClick,
  onResetFilters,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  mobileSidebarOpen,
  setMobileSidebarOpen,
  mapLayer,
  setMapLayer,
  showHeatmap,
  setShowHeatmap,
  heatmapLoading,
}) {
  const { user } = useContext(AuthContext);
  const resolved = mapStats?.resolved ?? 0;
  const inWork = inProgressCount ?? 0;

  const renderSidebar = () => (
    <>
      <p className={styles.sidebarTitle}>Категории</p>
      <button
        type="button"
        className={`${styles.catItem}${!mapDomainFilter ? ` ${styles.catItemActive}` : ""}`}
        onClick={() => setMapDomainFilter("")}
      >
        <span className={styles.catIcon} style={{ background: "#444" }}>
          <IconGrid size={16} />
        </span>
        <span className={styles.catLabel}>Все категории</span>
        <span className={styles.catCount}>{categoryCounts?.all ?? 0}</span>
      </button>
      {(taxonomy?.domains || []).map((d) => {
        const ui = CATEGORY_UI[d.key] || { bg: "#555", short: d.label_ru };
        return (
          <button
            key={d.key}
            type="button"
            className={`${styles.catItem}${
              mapDomainFilter === d.key ? ` ${styles.catItemActive}` : ""
            }`}
            onClick={() =>
              setMapDomainFilter((k) => (k === d.key ? "" : d.key))
            }
          >
            <span className={styles.catIcon} style={{ background: ui.bg }}>
              <CategoryIcon domainKey={d.key} size={16} />
            </span>
            <span className={styles.catLabel}>{ui.short || d.label_ru}</span>
            <span className={styles.catCount}>{categoryCounts?.[d.key] ?? 0}</span>
          </button>
        );
      })}

      <hr className={styles.sidebarDivider} />
      <p className={styles.sidebarTitle}>Фильтр по статусу</p>
      <label className={styles.checkRow}>
        <input
          type="checkbox"
          checked={STATUS_KEYS.every((k) => statusChecks[k])}
          onChange={(e) => onStatusCheckAll(e.target.checked)}
        />
        <span>Все статусы</span>
      </label>
      {STATUS_KEYS.map((key) => (
        <label key={key} className={styles.checkRow}>
          <input
            type="checkbox"
            checked={!!statusChecks[key]}
            onChange={(e) => onStatusCheckChange(key, e.target.checked)}
          />
          <span>
            {key === "pending"
              ? "На рассмотрении"
              : key === "approved"
                ? "Принято"
                : key === "in_progress"
                  ? "В работе"
                  : key === "resolved"
                    ? "Решено"
                    : "Отклонено"}
          </span>
        </label>
      ))}

      <hr className={styles.sidebarDivider} />
      <p className={styles.sidebarTitle}>Показ на карте</p>
      <div className={styles.mapLayerGroup}>
        <div className={styles.mapLayerRow}>
          {MAP_LAYER_OPTS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`${styles.mapLayerBtn}${
                !showHeatmap && mapLayer === opt.key ? ` ${styles.mapLayerBtnActive}` : ""
              }`}
              onClick={() => {
                setShowHeatmap(false);
                setMapLayer(opt.key);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`${styles.heatmapBtn}${showHeatmap ? ` ${styles.heatmapBtnOn}` : ""}`}
          disabled={heatmapLoading}
          onClick={() => setShowHeatmap((v) => !v)}
        >
          <IconLayers size={16} />
          {heatmapLoading ? "Загрузка…" : showHeatmap ? "Метки" : "Теплокарта"}
        </button>
      </div>
    </>
  );

  return (
    <div className={styles.page}>
      <div className={styles.statsBar}>
        <div className={styles.statsTab}>
          <IconList size={16} />
          Сообщения
        </div>
        <div className={styles.statsCenter}>
          <div className={styles.statBlock}>
            <span className={styles.statIcon} aria-hidden>
              <IconCheck size={18} />
            </span>
            <div>
              <strong className={styles.statNum}>{resolved}</strong>
              <span className={styles.statLabel}>проблем решено</span>
            </div>
          </div>
          <span className={styles.statDivider} aria-hidden="true" />
          <div className={styles.statBlock}>
            <span className={styles.statIcon} aria-hidden>
              <IconSettings size={18} />
            </span>
            <div>
              <strong className={styles.statNum}>{inWork}</strong>
              <span className={styles.statLabel}>проблем в работе</span>
            </div>
          </div>
        </div>
        <button type="button" className={styles.reportBtn} onClick={onReportClick}>
          Сообщить о проблеме
        </button>
      </div>

      <div className={styles.workspace}>
        <aside className={styles.sidebar} aria-label="Фильтры">
          {renderSidebar()}
        </aside>
        {mobileSidebarOpen ? (
          <>
            <button
              type="button"
              className={styles.drawerBackdrop}
              aria-label="Закрыть"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className={styles.drawer}>
              <button
                type="button"
                className={styles.drawerClose}
                onClick={() => setMobileSidebarOpen(false)}
              >
                <IconX size={18} />
              </button>
              {renderSidebar()}
            </div>
          </>
        ) : null}

        <div className={styles.mainCol}>
          <button
            type="button"
            className={styles.mobileCatsBtn}
            onClick={() => setMobileSidebarOpen(true)}
          >
            <IconMenu size={16} /> Фильтры
          </button>

          <div className={styles.filterRow}>
            <div className={styles.filterSearchWrap}>
              <span className={styles.filterSearchIcon} aria-hidden>
                <IconSearch size={16} />
              </span>
              <input
                id="main-map-search"
                type="search"
                className={styles.filterSearch}
                placeholder="Поиск по адресу или описанию…"
                value={mapSearch}
                onChange={(e) => setMapSearch(e.target.value)}
                aria-busy={searchLoading}
              />
            </div>
            <input
              type="date"
              className={styles.filterDate}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="Дата от"
            />
            <span className={styles.filterDateSep}>—</span>
            <input
              type="date"
              className={styles.filterDate}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="Дата до"
            />
            <button type="button" className={styles.resetBtn} onClick={onResetFilters}>
              <IconX size={16} />
              Сбросить
            </button>
          </div>

          <div className={styles.mapArea}>{children}</div>
        </div>
      </div>

      <MainPageMarkerList
        markers={paginatedMarkers}
        totalCount={filteredTotal}
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
        onCardClick={onFocusMarker}
        user={user}
      />
    </div>
  );
}
