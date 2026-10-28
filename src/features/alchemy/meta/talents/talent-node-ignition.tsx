import { useId, useLayoutEffect, useState, type RefObject } from "react";

interface BorderGeometry {
  width: number;
  height: number;
  inset: number;
  radius: number;
}

/** Decorative strokes share the real border's centerline, including its rounded corners. */
export function TalentNodeIgnition({
  frameRef,
  active,
}: {
  frameRef: RefObject<HTMLSpanElement | null>;
  active: boolean;
}) {
  const id = useId();
  const [geometry, setGeometry] = useState<BorderGeometry | null>(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => {
      const bounds = frame.getBoundingClientRect();
      const style = getComputedStyle(frame);
      const inset = parseFloat(style.borderTopWidth) / 2;
      if (bounds.width <= 0 || bounds.height <= 0 || !Number.isFinite(inset)) return;
      const next = {
        width: bounds.width,
        height: bounds.height,
        inset,
        radius: Math.max(0, parseFloat(style.borderTopLeftRadius) - inset),
      };
      setGeometry((current) =>
        current &&
        Object.keys(next).every((key) => current[key as keyof BorderGeometry] === next[key as keyof BorderGeometry])
          ? current
          : next,
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [frameRef]);

  if (!geometry || geometry.width <= 0 || geometry.height <= 0) return null;
  const { width, height, inset, radius } = geometry;
  const rect = { x: inset, y: inset, width: width - inset * 2, height: height - inset * 2, rx: radius, ry: radius };

  return (
    <svg
      className="talent-node-ignition"
      viewBox={`0 0 ${width} ${height}`}
      data-active={active ? "true" : undefined}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter id={`${id}-halo`} filterUnits="userSpaceOnUse" x={-48} y={-48} width={width + 96} height={height + 96}>
          <feGaussianBlur stdDeviation={2.5} />
        </filter>
        <mask id={`${id}-annulus`} maskUnits="userSpaceOnUse" x={-4} y={-4} width={width + 8} height={height + 8}>
          <rect {...rect} fill="none" stroke="white" strokeWidth={inset * 2 + 1} />
        </mask>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0.25" stopColor="white" stopOpacity="0" />
          <stop offset="0.40" stopColor="white" stopOpacity="0.15" />
          <stop offset="0.52" stopColor="#fff8df" stopOpacity="0.9" />
          <stop offset="0.72" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect {...rect} className="talent-ignition-track" pathLength={100} fill="none" strokeWidth={inset * 2} />
      <rect
        {...rect}
        className="talent-metal-outline talent-ignition-halo"
        pathLength={100}
        fill="none"
        strokeWidth={6.5}
        strokeLinecap="round"
        filter={`url(#${id}-halo)`}
      />
      <rect
        {...rect}
        className="talent-metal-outline talent-ignition-core"
        pathLength={100}
        fill="none"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <g mask={`url(#${id}-annulus)`}>
        <rect
          className="talent-ignition-shine"
          x={-width}
          y={-height}
          width={width * 3}
          height={height * 3}
          fill={`url(#${id}-shine)`}
        />
      </g>
    </svg>
  );
}
