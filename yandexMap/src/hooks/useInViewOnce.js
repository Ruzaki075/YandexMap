import { useEffect, useRef, useState } from "react";

/** Элемент попал в viewport один раз (для анимаций при скролле). */
export function useInViewOnce(options = { threshold: 0.15 }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return undefined;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      options
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- options стабильны с вызывающей стороны
  }, [inView]);

  return [ref, inView];
}
