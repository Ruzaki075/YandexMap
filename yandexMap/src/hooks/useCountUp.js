import { useEffect, useState } from "react";

/** Анимация числа от 0 до target (requestAnimationFrame). */
export function useCountUp(target, active, duration = 1500) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) {
      setValue(0);
      return undefined;
    }
    const end = Number(target) || 0;
    if (end === 0) {
      setValue(0);
      return undefined;
    }
    const t0 = performance.now();
    let frame = 0;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - (1 - p) ** 3;
      setValue(Math.round(end * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active, duration]);

  return value;
}
