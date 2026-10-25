import { useLayoutEffect, useRef, useState } from "react";
import { useGameTranslation } from "@/components/use-game-translation";
import { REACTION_DEFINITIONS } from "@/lib/battle";
import { COMBAT_TEXT_BASE_SIZE_PX } from "@/lib/game-constants";
import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import { getKeywordTextShineColors } from "@/lib/keyword-text-shine";
import { cn } from "@/lib/utils";
import { ShineText } from "../../../../shared/ui/shine-text";
import type { ReactionAnnouncement } from "../../../../shared/types";

export function ReactionTextRail({ announcements }: { announcements: ReactionAnnouncement[] }) {
  const i18n = useGameTranslation();
  const staticMotion = useReducedMotionPreference();
  const railRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState<number | undefined>();
  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail || announcements.length === 0) return;
    const fit = () => {
      if (rail.clientWidth <= 0) return;
      const base = Number.parseFloat(getComputedStyle(rail).fontSize);
      let fitted = base;
      for (const name of rail.querySelectorAll<HTMLElement>("[data-reaction]")) {
        const glyphs = name.firstElementChild as HTMLElement | null;
        if (!glyphs || glyphs.offsetWidth <= 0) continue;
        const current = Number.parseFloat(getComputedStyle(name).fontSize);
        fitted = Math.min(fitted, ((current * name.clientWidth) / (glyphs.offsetWidth * 1.08)) * 0.98);
      }
      setFontSize((previous) => (previous !== undefined && Math.abs(previous - fitted) < 0.2 ? previous : fitted));
    };
    fit();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    observer?.observe(rail);
    if (rail.parentElement) observer?.observe(rail.parentElement);
    document.fonts?.addEventListener("loadingdone", fit);
    return () => {
      observer?.disconnect();
      document.fonts?.removeEventListener("loadingdone", fit);
    };
  }, [announcements, i18n]);
  // The global reduced-motion duration override would otherwise start font-size
  // transitions on every descendant and feed intermediate widths back into fitting.
  return (
    <div
      ref={railRef}
      data-testid="reaction-text-rail"
      className="pointer-events-none relative z-40 flex w-full flex-col items-center gap-2 py-1 [&_*]:transition-none"
      style={{ fontSize: `calc(${COMBAT_TEXT_BASE_SIZE_PX * 1.25}px * var(--content-scale, 1))` }}
    >
      {announcements.map((announcement) => (
        <div
          key={announcement.id}
          data-testid="reaction-announcement"
          data-announcement-id={announcement.id}
          data-target={announcement.target}
          data-first-shown-at={announcement.firstShownAt}
          className={cn(
            "grid w-full justify-items-center gap-x-3 gap-y-1 leading-tight font-bold tracking-wide",
            "[filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.95))]",
            announcement.reactionIds.length >= 3 && "grid-cols-2",
          )}
          style={{ fontSize: fontSize ?? "inherit" }}
        >
          {announcement.reactionIds.map((id) => {
            const definition = REACTION_DEFINITIONS[id];
            return (
              <span
                key={id}
                data-testid="reaction-text"
                data-reaction={id}
                className="block w-full min-w-0 text-center whitespace-nowrap"
              >
                <ShineText
                  colors={getKeywordTextShineColors(definition.keywords)}
                  className={cn("reaction-text-shine", staticMotion && "reaction-text-static")}
                >
                  {i18n.displayText(definition.text)}
                </ShineText>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
