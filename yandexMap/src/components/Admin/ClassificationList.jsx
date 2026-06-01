import React, { memo, useCallback, useMemo, useState } from "react";
import ClassificationCard from "./ClassificationCard.jsx";
import { VIRTUALIZE_THRESHOLD } from "./classificationConstants.js";

function ClassificationList({
  items,
  busy,
  orderMode,
  onEdit,
  onDelete,
  onReorder,
}) {
  const [dragKey, setDragKey] = useState(null);

  const handleDragStart = useCallback((key) => {
    setDragKey(key);
  }, []);

  const handleDragOver = useCallback((e) => {
    if (orderMode) e.preventDefault();
  }, [orderMode]);

  const handleDrop = useCallback(
    (targetKey) => {
      if (!orderMode || !dragKey || dragKey === targetKey) {
        setDragKey(null);
        return;
      }
      const keys = items.map((c) => c.key);
      const from = keys.indexOf(dragKey);
      const to = keys.indexOf(targetKey);
      if (from < 0 || to < 0) return;
      keys.splice(from, 1);
      keys.splice(to, 0, dragKey);
      setDragKey(null);
      onReorder(keys);
    },
    [orderMode, dragKey, items, onReorder]
  );

  const dragProps = useCallback(
    (key) =>
      orderMode
        ? {
            draggable: true,
            onDragStart: () => handleDragStart(key),
            onDragOver: handleDragOver,
            onDrop: () => handleDrop(key),
            onDragEnd: () => setDragKey(null),
          }
        : {},
    [orderMode, handleDragStart, handleDragOver, handleDrop]
  );

  const listClass = useMemo(
    () =>
      `tax-list${orderMode ? " tax-list--ordering" : ""}${
        items.length > VIRTUALIZE_THRESHOLD ? " tax-list--scroll" : ""
      }`,
    [orderMode, items.length]
  );

  if (items.length === 0) {
    return <p className="tax-empty">Ничего не найдено</p>;
  }

  return (
    <div className={listClass}>
      {items.map((row) => (
        <div
          key={row.key}
          className={`tax-list__item${dragKey === row.key ? " tax-list__item--drag" : ""}`}
          {...(orderMode
            ? {
                onDragOver: handleDragOver,
                onDrop: () => handleDrop(row.key),
              }
            : {})}
        >
          <ClassificationCard
            row={row}
            busy={busy}
            onEdit={onEdit}
            onDelete={onDelete}
            dragHandleProps={dragProps(row.key)}
          />
        </div>
      ))}
    </div>
  );
}

export default memo(ClassificationList);
