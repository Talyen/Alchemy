// Wrapper over `useSequentialFadeSwap` (which builds on `fade-presence.ts:useFadePresence`).
// Primitive stack: `useHeldWhile`/`useFadePresence` (fade-presence.ts) →
// `useSequentialFadeSwap` → `FadeSlot` (this file). `portaled-tooltip.tsx:64-70`
// keeps a separate inline fade — see TODO there.
import { useRef, type HTMLAttributes, type ReactNode } from "react";

import { MOTION_FADE_MS } from "@/lib/game-constants";
import { cn } from "@/lib/utils";

import { fadePhaseClass } from "./fade-presence";
import { useSequentialFadeSwap } from "./use-sequential-fade-swap";

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
  if (shownKey === swapKey) {
    // eslint-disable-next-line react-hooks/refs -- snapshot the outgoing view before swapKey changes
    heldRef.current = children;
    // eslint-disable-next-line react-hooks/refs -- snapshot wrapper layout with the outgoing view
    heldClassNameRef.current = className;
  }

  return (
    <div
      className={cn(
        fadePhaseClass(phase),
        // eslint-disable-next-line react-hooks/refs -- hold outgoing layout while opacity is 0
        shownKey === swapKey ? className : heldClassNameRef.current,
      )}
      {...props}
    >
      {/* eslint-disable-next-line react-hooks/refs -- hold the outgoing child while opacity is 0 */}
      {shownKey === swapKey ? children : heldRef.current}
    </div>
  );
}
