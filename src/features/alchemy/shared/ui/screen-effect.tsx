import type { CSSProperties } from "react";
import type { ScreenEffectsSettings } from "@/lib/screen-effect-settings";
import { cn } from "@/lib/utils";
import "./screen-effect.css";

export function ScreenEffect({ settings }: { settings: ScreenEffectsSettings }) {
  const { scanlines, tint, edges, grain } = settings;
  const visible = (effect: { enabled: boolean; strength: number }) => effect.enabled && effect.strength > 0;
  if (!settings.enabled || ![scanlines, tint, edges, grain].some(visible)) return null;

  // Outside the scaled game stage, so texture pitch is independent of Game Size.
  return (
    <div aria-hidden="true" className="screen-effect">
      {visible(tint) ? (
        <div
          className={cn("screen-effect-layer", "screen-effect-tint", `screen-effect-tint-${tint.color}`)}
          style={{ opacity: tint.strength / 100 }}
        />
      ) : null}
      {visible(grain) ? (
        <div className="screen-effect-layer screen-effect-grain" style={{ opacity: (0.1 * grain.strength) / 100 }} />
      ) : null}
      {visible(scanlines) ? (
        <div
          className="screen-effect-layer screen-effect-scanlines"
          style={
            {
              opacity: (0.75 * scanlines.strength) / 100,
              "--scanline-size": `${scanlines.spacing === "fine" ? 1 : scanlines.spacing === "wide" ? 3 : 2}px`,
            } as CSSProperties
          }
        />
      ) : null}
      {visible(edges) ? (
        <div className="screen-effect-layer screen-effect-edges" style={{ opacity: edges.strength / 100 }} />
      ) : null}
    </div>
  );
}
