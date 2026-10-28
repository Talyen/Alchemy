import { cn } from "@/lib/utils";

import { useId, useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

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

  const perimeter = 2 * (rect.width + rect.height - 4 * radius) + 2 * Math.PI * radius;
  const topCenter = ((rect.width - 2 * radius) / 2 / perimeter) * 100;
  const start = -(topCenter + 50 - 5);

  return (
    <svg
      className="talent-node-ignition"
      viewBox={`0 0 ${width} ${height}`}
      style={
        {
          "--talent-arc-start": `${start}px`,
          "--talent-arc-forward-end": `${start - 50}px`,
          "--talent-arc-back-end": `${start + 50}px`,
        } as CSSProperties
      }
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
          <stop offset="0.3" stopColor="white" stopOpacity="0" />
          <stop offset="0.48" stopColor="white" stopOpacity="0.15" />
          <stop offset="0.54" stopColor="#fff8df" stopOpacity="0.9" />
          <stop offset="0.65" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect {...rect} className="talent-ignition-track" pathLength={100} fill="none" strokeWidth={inset * 2} />
      {(["forward", "back"] as const).map((direction) => (
        <g key={direction}>
          <rect
            {...rect}
            className={cn(
              "talent-ignition-dash talent-ignition-halo",
              direction === "forward" ? "talent-twin-forward" : "talent-twin-back",
            )}
            pathLength={100}
            fill="none"
            strokeWidth={6.5}
            strokeLinecap="round"
            strokeDasharray="10 90"
            filter={`url(#${id}-halo)`}
          />
          <rect
            {...rect}
            className={cn(
              "talent-ignition-dash talent-ignition-core",
              direction === "forward" ? "talent-twin-forward" : "talent-twin-back",
            )}
            pathLength={100}
            fill="none"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeDasharray="10 90"
          />
        </g>
      ))}
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
