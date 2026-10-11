import { autoUpdate } from "@floating-ui/dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import type { PlasmaColorPair } from "@/lib/animation/plasma-colors";
import { KeywordPlasmaBackground } from "./keyword-plasma-background";
import { useFadePresence, useHeldWhile } from "./use-fade";

const FADE_OUT_MS = 700;

export function InteractionPlasmaBackground({
  colorPair,
  intensity,
}: {
  colorPair: PlasmaColorPair | null;
  intensity: number;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const candidateRef = useRef<HTMLElement | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const reducedMotion = useReducedMotionPreference();
  const visible = colorPair !== null && intensity > 0 && !reducedMotion;
  const { mounted } = useFadePresence(visible, FADE_OUT_MS);
  const heldColors = useHeldWhile(visible, colorPair);

  useEffect(() => {
    const rememberAnchor = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element) || target.closest('[role="tooltip"]')) return;
      // Capture the control before its hover/focus handlers register a palette.
      // Portaled tooltips keep the original trigger as the source of the halo.
      const control = target.closest<HTMLElement>('button, [role="button"], [data-plasma-anchor], [tabindex]');
      if (control) candidateRef.current = control;
    };
    document.addEventListener("mouseover", rememberAnchor, true);
    document.addEventListener("focusin", rememberAnchor, true);
    return () => {
      document.removeEventListener("mouseover", rememberAnchor, true);
      document.removeEventListener("focusin", rememberAnchor, true);
    };
  }, []);

  useLayoutEffect(() => {
    if (colorPair) setAnchor(candidateRef.current);
  }, [colorPair]);

  useLayoutEffect(() => {
    const layer = layerRef.current;
    const stage = layer?.parentElement;
    if (!layer || !stage || !anchor || !visible) return;
    const update = () => {
      if (!anchor.isConnected) return;
      const rect = anchor.getBoundingClientRect();
      const bounds = stage.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const scaleX = stage.clientWidth / bounds.width;
      const scaleY = stage.clientHeight / bounds.height;
      // Reserve space outside opaque artwork. Capping the whole halo or fading
      // at 70% of its radius can put nearly all visible light under tall cards.
      const padding = Math.min(96, stage.clientWidth * 0.08, stage.clientHeight * 0.08);
      const width = rect.width * scaleX + padding * 2;
      const height = rect.height * scaleY + padding * 2;
      layer.style.left = `${(rect.left + rect.width / 2 - bounds.left) * scaleX - width / 2}px`;
      layer.style.top = `${(rect.top + rect.height / 2 - bounds.top) * scaleY - height / 2}px`;
      layer.style.width = `${width}px`;
      layer.style.height = `${height}px`;
    };
    return autoUpdate(anchor, stage, update, { animationFrame: true });
  }, [anchor, visible]);

  return (
    <div
      ref={layerRef}
      aria-hidden
      data-testid="interaction-plasma-background"
      className="pointer-events-none absolute"
      style={{
        opacity: visible && anchor ? 1 : 0,
        transition: reducedMotion ? "none" : `opacity ${visible ? 500 : FADE_OUT_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        maskImage: "radial-gradient(ellipse, black 60%, transparent 100%)",
      }}
    >
      <KeywordPlasmaBackground
        colorPair={heldColors}
        intensity={intensity}
        active={mounted}
        testIdPrefix="interaction"
      />
    </div>
  );
}
