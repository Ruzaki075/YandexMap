import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { List, useListRef } from "react-window";
import { ROW_HEIGHT } from "./moderationConstants.js";
import ModerationItem from "./ModerationItem.jsx";

function Row({ index, style, markers, taxonomy, focusIndex, selectedIds, onSelect, onToggleCheck }) {
  const m = markers[index];
  if (!m) return null;
  const selected = selectedIds.includes(m.id);
  return (
    <ModerationItem
      marker={m}
      index={index}
      style={style}
      taxonomy={taxonomy}
      isActive={focusIndex === index}
      isSelected={selected}
      onSelect={onSelect}
      onToggleCheck={onToggleCheck}
    />
  );
}

function ModerationList({
  markers,
  taxonomy,
  focusIndex,
  selectedIds,
  onSelect,
  onToggleCheck,
  loading,
  total,
  page,
  pageSize,
  onPageChange,
  listRef,
}) {
  const containerRef = useRef(null);
  const [listHeight, setListHeight] = useState(400);
  const innerListRef = useListRef();
  useEffect(() => {
    if (listRef) listRef.current = innerListRef.current;
  }, [listRef, innerListRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => {
      setListHeight(Math.max(200, el.clientHeight));
    });
    ro.observe(el);
    setListHeight(Math.max(200, el.clientHeight));
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (focusIndex >= 0 && innerListRef.current?.scrollToRow) {
      innerListRef.current.scrollToRow({
        index: focusIndex,
        align: "smart",
      });
    }
  }, [focusIndex, markers.length]);

  const rowProps = useMemo(
    () => ({
      markers,
      taxonomy,
      focusIndex,
      selectedIds,
      onSelect,
      onToggleCheck,
    }),
    [markers, taxonomy, focusIndex, selectedIds, onSelect, onToggleCheck]
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const rowComponent = useCallback(
    (props) => <Row {...props} {...rowProps} />,
    [rowProps]
  );

  return (
    <section className="mod-v2-list-panel" aria-label="Очередь обращений">
      <div className="mod-v2-list-head">
        <span>
          {loading ? "Загрузка…" : `${markers.length} из ${total}`}
        </span>
        <div className="mod-v2-pager">
          <button
            type="button"
            className="mod-v2-pager__btn"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
            aria-label="Предыдущая страница"
          >
            ‹
          </button>
          <span className="mod-v2-pager__info">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className="mod-v2-pager__btn"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
            aria-label="Следующая страница"
          >
            ›
          </button>
        </div>
      </div>

      <div ref={containerRef} className="mod-v2-list-scroll">
        {loading && markers.length === 0 ? (
          <div className="mod-v2-skeleton" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="mod-v2-skeleton__row" />
            ))}
          </div>
        ) : markers.length === 0 ? (
          <p className="mod-v2-empty">Нет обращений по фильтрам</p>
        ) : (
          <List
            listRef={innerListRef}
            rowCount={markers.length}
            rowHeight={ROW_HEIGHT}
            rowComponent={rowComponent}
            rowProps={rowProps}
            style={{ height: listHeight, width: "100%" }}
            overscanCount={6}
          />
        )}
      </div>
    </section>
  );
}

export default memo(ModerationList);
