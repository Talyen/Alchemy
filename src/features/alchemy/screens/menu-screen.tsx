// Main menu screen with logo and navigation buttons. Entry point for all other screens.
import type { CSSProperties } from "react";

import { BookOpen, Cog, Swords, TreePine, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { staticCardTransform } from "../config";
import { clearTiltFromEvent, setTiltFromEvent } from "../utils";

export function MenuScreen({ onPlay, onCollection, onOptions, onTalents, onHomestead, onQuit, logoSrc, hasActiveBattle, hasActiveRun, isMobileLandscape = false }: { onPlay: () => void; onCollection: () => void; onOptions: () => void; onTalents: () => void; onHomestead: () => void; onQuit?: () => void; logoSrc: string; hasActiveBattle?: boolean; hasActiveRun?: boolean; isMobileLandscape?: boolean }) {
  return (
    <div className={`flex h-full w-full flex-col items-center justify-center text-center ${isMobileLandscape ? "gap-2" : "gap-8"}`}>
      <div
        className="tilt-surface relative w-full"
        style={{
          "--card-base-transform": staticCardTransform,
          maskImage: "radial-gradient(ellipse 72% 72% at center, black 60%, transparent 76%)",
          WebkitMaskImage: "radial-gradient(ellipse 72% 72% at center, black 60%, transparent 76%)",
          maxWidth: isMobileLandscape ? "220px" : "430px",
        } as CSSProperties}
        data-tilt-strength="6"
        onMouseMove={setTiltFromEvent}
        onMouseLeave={clearTiltFromEvent}
      >
        <img src={logoSrc} alt="Alchemy logo" className="w-full object-contain" loading="eager" />
      </div>

      <div className="grid gap-2">
        <Button size={isMobileLandscape ? "sm" : "lg"} className={`stagger-item justify-center gap-2 ${isMobileLandscape ? "w-36 text-xs" : "w-56 text-base"}`} style={{ "--stagger-index": 0 } as CSSProperties} onClick={onPlay}>
          <Swords className={isMobileLandscape ? "h-3.5 w-3.5" : "h-4 w-4"} />{hasActiveBattle || hasActiveRun ? "Resume Run" : "Play"}
        </Button>
        <Button size={isMobileLandscape ? "sm" : "lg"} variant="outline" className={`stagger-item justify-center gap-2 ${isMobileLandscape ? "w-36 text-xs" : "w-56 text-base"}`} style={{ "--stagger-index": 1 } as CSSProperties} onClick={onCollection}>
          <BookOpen className={isMobileLandscape ? "h-3.5 w-3.5" : "h-4 w-4"} />Collection
        </Button>
        <Button size={isMobileLandscape ? "sm" : "lg"} variant="outline" className={`stagger-item justify-center gap-2 ${isMobileLandscape ? "w-36 text-xs" : "w-56 text-base"}`} style={{ "--stagger-index": 2 } as CSSProperties} onClick={onTalents}>
          <WandSparkles className={isMobileLandscape ? "h-3.5 w-3.5" : "h-4 w-4"} />Talents
        </Button>
        <Button size={isMobileLandscape ? "sm" : "lg"} variant="outline" className={`stagger-item justify-center gap-2 ${isMobileLandscape ? "w-36 text-xs" : "w-56 text-base"}`} style={{ "--stagger-index": 3 } as CSSProperties} onClick={onHomestead}>
          <TreePine className={isMobileLandscape ? "h-3.5 w-3.5" : "h-4 w-4"} />Homestead
        </Button>
        <Button size={isMobileLandscape ? "sm" : "lg"} variant="outline" className={`stagger-item justify-center gap-2 ${isMobileLandscape ? "w-36 text-xs" : "w-56 text-base"}`} style={{ "--stagger-index": 4 } as CSSProperties} onClick={onOptions}>
          <Cog className={isMobileLandscape ? "h-3.5 w-3.5" : "h-4 w-4"} />Options
        </Button>
        {onQuit ? (
          <Button size={isMobileLandscape ? "sm" : "lg"} variant="outline" className={`stagger-item justify-center gap-2 ${isMobileLandscape ? "w-36 text-xs" : "w-56 text-base"}`} style={{ "--stagger-index": 5 } as CSSProperties} onClick={onQuit}>
            Quit
          </Button>
        ) : null}
      </div>
    </div>
  );
}
