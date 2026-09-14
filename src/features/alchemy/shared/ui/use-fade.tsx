import { useArtworkReady } from "./use-artwork-ready";
import { useLatestRef } from "./use-latest-ref";
import { Fragment, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";

import { resolveGameDelay } from "@/lib/animation/game-timer";
import { MOTION_FADE_MS } from "@/lib/game-constants";
import { cn } from "@/lib/utils";

export type FadePhase = "enter" | "exit" | "idle";

export function fadePhaseClass(phase: FadePhase): string | undefined {
  if (phase === "exit") return "screen-fade-out";
  if (phase === "enter") return "screen-fade-in";
  return undefined;
}

export function useHeldWhile<T>(hold: boolean, value: T): T {
  const heldRef = useRef(value);
  if (hold) {
    // eslint-disable-next-line react-hooks/refs -- snapshot live value for exit phase before hold drops
    heldRef.current = value;
  }
  // eslint-disable-next-line react-hooks/refs -- read snapshotted value during exit phase
  return hold ? value : heldRef.current;
}

export function useFadePresence(
  open: boolean,
  durationMs: number = MOTION_FADE_MS,
): {
  mounted: boolean;
  phase: "enter" | "exit";
} {
  const [mounted, setMounted] = useState(open);

  if (open && !mounted) {
    setMounted(true);
  }

  useEffect(() => {
    if (open || !mounted) return;
    const timeout = window.setTimeout(() => setMounted(false), resolveGameDelay(durationMs));
    return () => window.clearTimeout(timeout);
  }, [open, mounted, durationMs]);

  return { mounted: open || mounted, phase: open ? "enter" : "exit" };
}

export function useSequentialFadeSwap<T>({
  target,
  durationMs,
  initialPhase = "idle",
  onSwap,
}: {
  target: T;
  durationMs: number;
  initialPhase?: FadePhase;
  onSwap?: () => void;
}): { shown: T; phase: FadePhase } {
  const [shown, setShown] = useState(target);
  const [phase, setPhase] = useState<FadePhase>(initialPhase);
  const [prevTarget, setPrevTarget] = useState(target);
  const onSwapRef = useLatestRef(onSwap);

  if (!Object.is(target, prevTarget)) {
    setPrevTarget(target);
    if (Object.is(target, shown)) {
      setPhase("enter");
    }
  }

  useEffect(() => {
    if (Object.is(target, shown)) {
      return;
    }
    const timeout = window.setTimeout(() => {
      onSwapRef.current?.();
      setShown(target);
      setPhase("enter");
    }, resolveGameDelay(durationMs));
    return () => window.clearTimeout(timeout);
  }, [target, shown, durationMs, onSwapRef]);

  // The first changed render must already be exiting; an effect can miss a paint.
  return { shown, phase: !Object.is(target, shown) ? "exit" : phase };
}

export function FadeSlot({
  swapKey,
  className,
  children,
  ...props
}: {
  swapKey: string | number;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  const { shown: shownKey, phase } = useSequentialFadeSwap({
    target: swapKey,
    durationMs: MOTION_FADE_MS,
  });
  const { ref: artworkRef, pending: artworkPending } = useArtworkReady(shownKey);
  const isLive = shownKey === swapKey;
  const heldChildren = useHeldWhile(isLive, children);
  const heldClassName = useHeldWhile(isLive, className);
  const heldStyle = useHeldWhile(isLive, (props as { style?: React.CSSProperties }).style);

  const { style: _style, ...restProps } = props;

  return (
    <div
      ref={artworkRef}
      data-artwork-pending={artworkPending}
      className={cn(fadePhaseClass(phase), isLive ? className : heldClassName)}
      style={isLive ? _style : heldStyle}
      {...restProps}
      inert={!isLive || (artworkPending ?? restProps.inert)}
    >
      <Fragment key={shownKey}>{isLive ? children : heldChildren}</Fragment>
    </div>
  );
}
