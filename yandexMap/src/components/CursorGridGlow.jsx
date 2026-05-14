import { useEffect } from "react";

/**
 * Обновляет --cursor-x / --cursor-y на элементах .page-aurora для фона-сетки с «подсветкой» курсора.
 * При prefers-reduced-motion: reduce — только статичный фон, без отслеживания мыши.
 */
export default function CursorGridGlow() {
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return undefined;

    let rafId = 0;
    let pending = null;

    const flush = () => {
      rafId = 0;
      const e = pending;
      pending = null;
      if (!e) return;
      document.querySelectorAll(".page-aurora").forEach((el) => {
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--cursor-x", `${e.clientX - rect.left}px`);
        el.style.setProperty("--cursor-y", `${e.clientY - rect.top}px`);
      });
    };

    const onMove = (e) => {
      pending = e;
      if (!rafId) rafId = requestAnimationFrame(flush);
    };

    document.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      document.removeEventListener("mousemove", onMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return null;
}
