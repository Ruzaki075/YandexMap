import { useRef, useCallback } from "react";

/** Свайп вниз по ручке bottom sheet для закрытия. */
export function useBottomSheetDrag(onClose, threshold = 72) {
  const startY = useRef(0);
  const dragging = useRef(false);

  const onTouchStart = useCallback((e) => {
    startY.current = e.touches[0].clientY;
    dragging.current = true;
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!dragging.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 12) e.preventDefault();
  }, []);

  const onTouchEnd = useCallback(
    (e) => {
      if (!dragging.current) return;
      dragging.current = false;
      const dy = e.changedTouches[0].clientY - startY.current;
      if (dy > threshold) onClose?.();
    },
    [onClose, threshold]
  );

  return { onTouchStart, onTouchMove, onTouchEnd };
}
