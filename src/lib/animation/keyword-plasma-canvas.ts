// Canvas blob approximation of Trinket keyword plasma — four moving radial charges with screen blend.
import { parsePlasmaHexColor } from "@/lib/animation/plasma-colors";
import { createPlasmaLifecycle } from "./keyword-plasma-lifecycle";
import type { PlasmaRendererOptions } from "./keyword-plasma-types";

function chargeCenters(time: number): Array<[number, number]> {
  const ht = time;
  return [
    [Math.sin(ht * 0.3) * 0.65, Math.cos(ht * 0.36) * 0.58],
    [Math.cos(ht * 0.25 + 1.5) * 0.7, Math.sin(ht * 0.32 + 1.0) * 0.62],
    [Math.sin(ht * 0.34 + 3.2) * 0.68, Math.cos(ht * 0.28 + 2.4) * 0.6],
    [Math.cos(ht * 0.26 + 4.8) * 0.62, Math.sin(ht * 0.35 + 4.0) * 0.65],
  ];
}

function smoothstep(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function mixRgb(
  primary: [number, number, number],
  secondary: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    primary[0] + (secondary[0] - primary[0]) * t,
    primary[1] + (secondary[1] - primary[1]) * t,
    primary[2] + (secondary[2] - primary[2]) * t,
  ];
}

function toRgba(rgb: [number, number, number], alpha: number): string {
  const r = Math.round(rgb[0] * 255);
  const g = Math.round(rgb[1] * 255);
  const b = Math.round(rgb[2] * 255);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function startCanvasKeywordPlasma({
  canvas,
  colorsRef,
  focalYOffset,
  active,
}: PlasmaRendererOptions): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const lifecycle = createPlasmaLifecycle({
    canvas,
    active: () => active,
    onFrame: (time, width, height) => {
      if (width <= 0 || height <= 0) return;

      const scaleX = canvas.width / width;
      const scaleY = canvas.height / height;
      ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const focalX = width / 2;
      const focalY = height / 2 - focalYOffset;
      const unit = Math.min(width, height);
      const primary = parsePlasmaHexColor(colorsRef.current.primary);
      const secondary = parsePlasmaHexColor(colorsRef.current.secondary);
      const centers = chargeCenters(time);

      ctx.globalCompositeOperation = "lighter";

      for (const [cx, cy] of centers) {
        const px = focalX + cx * unit;
        const py = focalY + cy * unit;
        const dx = (width / 2 - px) / unit;
        const dy = (height / 2 - py) / unit;
        const dist = Math.hypot(dx, dy);
        const field = 1 / (1 + dist * dist * 2.2);
        const wave = Math.sin((px / unit) * 2 + time * 0.12) * Math.cos((py / unit) * 2 - time * 0.15) * 0.1;
        const fluid = smoothstep(Math.max(0, Math.min(1, field + wave)));
        const radialFalloff = 1 / (1 + dist * dist * 1.4);
        const alpha = Math.min(0.22, fluid * radialFalloff * 0.18);
        const mixT = Math.min(1, fluid * 1.2);
        const radius = unit * 0.55;
        const inner = mixRgb(primary, secondary, mixT);

        const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius);
        gradient.addColorStop(0, toRgba(inner, alpha));
        gradient.addColorStop(0.45, toRgba(inner, alpha * 0.55));
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";
    },
  });

  return () => lifecycle.dispose();
}
