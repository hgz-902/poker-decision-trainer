import { useEffect, useMemo, useRef, useState } from "react";

export function useScaleToFit(baseWidth: number) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const [outerWidth, setOuterWidth] = useState<number>(baseWidth);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? baseWidth;
      setOuterWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [baseWidth]);

  const scale = useMemo(() => {
    // outerWidth가 baseWidth보다 크면 1(확대 안 함), 작으면 축소
    const s = outerWidth / baseWidth;
    return Math.min(1, Math.max(0.3, s)); // 너무 작아도 0.3까지만
  }, [outerWidth, baseWidth]);

  return { outerRef, scale };
}
