/* eslint-disable react-refresh/only-export-components -- fade primitives share a single canonical module per docs/UI.md */
import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";

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
  const [held, setHeld] = useState(value);
  useEffect(() => {
    if (!hold) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- snapshot the last live value so outro can keep rendering it
    setHeld(value);
  }, [hold, value]);
  return hold ? value : held;
}

export function useFadePresence(
  open: boolean,
  durationMs: number = MOTION_FADE_MS,
): {
  mounted: boolean;
  phase: "enter" | "exit";
} {
  const [mounted, setMounted] = useState(open);
  const [phase, setPhase] = useState<"enter" | "exit">(open ? "enter" : "exit");

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- presence mounts and plays enter when open becomes true
      setMounted(true);
      setPhase("enter");
      return;
    }
    if (!mounted) return;
    setPhase("exit");
    const timeout = window.setTimeout(() => setMounted(false), resolveGameDelay(durationMs));
    return () => window.clearTimeout(timeout);
  }, [open, mounted, durationMs]);

  return { mounted, phase };
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
  const onSwapRef = useRef(onSwap);
  // eslint-disable-next-line react-hooks/refs -- latest onSwap; not a render input
  onSwapRef.current = onSwap;

  useEffect(() => {
    if (Object.is(target, shown)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- cancelled swap must not leave the view on fade-out
      setPhase((current) => (current === "exit" ? "enter" : current));
      return;
    }
    setPhase("exit");
    const timeout = window.setTimeout(() => {
      onSwapRef.current?.();
      setShown(target);
      setPhase("enter");
    }, resolveGameDelay(durationMs));
    return () => window.clearTimeout(timeout);
  }, [target, shown, durationMs]);

  return { shown, phase };
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
  const heldRef = useRef(children);
  const heldClassNameRef = useRef(className);
  const heldStyleRef = useRef((props as { style?: React.CSSProperties }).style);
  if (shownKey === swapKey) {
    // eslint-disable-next-line react-hooks/refs -- snapshot the outgoing view before swapKey changes
    heldRef.current = children;
    // eslint-disable-next-line react-hooks/refs -- snapshot wrapper layout with the outgoing view
    heldClassNameRef.current = className;
    // eslint-disable-next-line react-hooks/refs -- snapshot wrapper style with the outgoing view
    heldStyleRef.current = (props as { style?: React.CSSProperties }).style;
  }

  const { style: _style, ...restProps } = props as { style?: React.CSSProperties };

  return (
    <div
      className={cn(
        fadePhaseClass(phase),
        // eslint-disable-next-line react-hooks/refs -- hold outgoing layout while opacity is 0
        shownKey === swapKey ? className : heldClassNameRef.current,
      )}
      // eslint-disable-next-line react-hooks/refs -- hold outgoing layout while opacity is 0
      style={shownKey === swapKey ? _style : heldStyleRef.current}
      {...restProps}
    >
      {/* eslint-disable-next-line react-hooks/refs -- hold the outgoing child while opacity is 0 */}
      {shownKey === swapKey ? children : heldRef.current}
    </div>
  );
}
