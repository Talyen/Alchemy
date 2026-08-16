// Enemy death Slice: jagged crack, split halves, and sparks. Replaces the old
// pixel-burst dissolve. Honors reduced-motion and e2e animation-disabled.
import { useLayoutEffect, useRef, useState } from "react";

import { isAnimationDisabled } from "@/lib/animation/animation-prefs";
import { SLICE_PRIMARY_CLIP_PATH, SLICE_SECONDARY_CLIP_PATH } from "@/lib/animation/slice-crack";
import { drawSliceFrame } from "@/lib/animation/slice-draw";
import { computeSliceVisual } from "@/lib/animation/slice-timeline";
import { playSliceDeath } from "@/lib/audio";
import { SLICE_DEATH_DURATION_MS } from "@/lib/game-constants";
import { cn } from "@/lib/utils";

interface SliceDeathProps {
  imageUrl: string;
  alt: string;
  imageClassName: string;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function shouldSkipSlice(): boolean {
  return isAnimationDisabled() || prefersReducedMotion();
}

function applyHalfTransform(
  el: HTMLImageElement,
  offsetX: number,
  offsetY: number,
  twistDeg: number,
  opacity: number,
): void {
  el.style.transform = `translate(${offsetX}px, ${offsetY}px) rotate(${twistDeg}deg)`;
  el.style.opacity = String(opacity);
}

export function SliceDeath({ imageUrl, alt, imageClassName }: SliceDeathProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLImageElement>(null);
  const rightRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [complete, setComplete] = useState(shouldSkipSlice);

  useLayoutEffect(() => {
    if (shouldSkipSlice()) return;

    const root = rootRef.current;
    const canvas = canvasRef.current;
    const left = leftRef.current;
    const right = rightRef.current;
    if (!root || !canvas || !left || !right) return;

    let rafId: number | null = null;
    let running = true;
    let started = false;

    const startSlice = (w: number, h: number) => {
      canvas.width = w * 2;
      canvas.height = h * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setComplete(true);
        return;
      }

      started = true;
      playSliceDeath();
      const originX = w / 2;
      const originY = h / 2;
      const start = performance.now();

      const frame = (now: number) => {
        rafId = null;
        if (!running) return;
        const progress = Math.min((now - start) / SLICE_DEATH_DURATION_MS, 1);
        const visual = computeSliceVisual(progress, w, h);
        applyHalfTransform(left, visual.leftOffset.x, visual.leftOffset.y, -visual.twistDeg, visual.halfOpacity);
        applyHalfTransform(right, visual.rightOffset.x, visual.rightOffset.y, visual.twistDeg, visual.halfOpacity);
        drawSliceFrame(ctx, visual, w, h, originX, originY);
        if (progress < 1) {
          rafId = requestAnimationFrame(frame);
        } else {
          setComplete(true);
        }
      };

      frame(start);
    };

    const tryStart = () => {
      if (!running || started) return;
      const rect = root.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w === 0 || h === 0) {
        rafId = requestAnimationFrame(tryStart);
        return;
      }
      startSlice(w, h);
    };

    tryStart();
    return () => {
      running = false;
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [imageUrl]);

  if (complete) {
    return <div className={cn("w-full", imageClassName)} aria-hidden />;
  }

  return (
    <div ref={rootRef} className="relative w-full overflow-visible">
      <img
        ref={leftRef}
        src={imageUrl}
        alt={alt}
        className={cn("block w-full", imageClassName)}
        style={{ clipPath: SLICE_PRIMARY_CLIP_PATH, transformOrigin: "center center" }}
        loading="eager"
      />
      <img
        ref={rightRef}
        src={imageUrl}
        alt=""
        aria-hidden
        className={cn("absolute inset-0 block w-full", imageClassName)}
        style={{ clipPath: SLICE_SECONDARY_CLIP_PATH, transformOrigin: "center center" }}
        loading="eager"
      />
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute -top-1/2 -left-1/2 z-10 h-[200%] w-[200%]"
      />
    </div>
  );
}
