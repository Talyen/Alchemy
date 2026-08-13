import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";

import { resolveGameDelay } from "@/lib/animation/game-timer";
import { MOTION_FADE_MS } from "@/lib/game-constants";
import { cn } from "@/lib/utils";

import { fadePhaseClass, type FadePhase } from "./fade-presence";

export function FadeSlot({
  swapKey,
  className,
  children,
  ...props
}: {
  swapKey: string | number;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  const [phase, setPhase] = useState<FadePhase>("idle");
  const [shownKey, setShownKey] = useState(swapKey);
  const heldRef = useRef(children);
  if (shownKey === swapKey) {
    // eslint-disable-next-line react-hooks/refs -- snapshot the outgoing view before swapKey changes
    heldRef.current = children;
  }

  useEffect(() => {
    if (swapKey === shownKey) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sequential fade-out before swapping slot identity
    setPhase("exit");
    const timeout = window.setTimeout(() => {
      setShownKey(swapKey);
      setPhase("enter");
    }, resolveGameDelay(MOTION_FADE_MS));
    return () => window.clearTimeout(timeout);
  }, [swapKey, shownKey]);

  return (
    <div className={cn(fadePhaseClass(phase), className)} {...props}>
      {/* eslint-disable-next-line react-hooks/refs -- hold the outgoing child while opacity is 0 */}
      {shownKey === swapKey ? children : heldRef.current}
    </div>
  );
}
