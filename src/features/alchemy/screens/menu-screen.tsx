// Main menu screen with logo and navigation buttons. Entry point for all other screens.
import type { CSSProperties } from "react";

import { Button } from "@/components/ui/button";

export function MenuScreen({ onPlay, onCollection, onOptions, onTalents, onQuit, logoSrc, hasActiveBattle }: { onPlay: () => void; onCollection: () => void; onOptions: () => void; onTalents: () => void; onQuit?: () => void; logoSrc: string; hasActiveBattle?: boolean }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 text-center">
      <img src={logoSrc} alt="Alchemy logo" className="w-full max-w-[430px] object-contain" loading="eager" />

      <div className="grid gap-3">
        <Button size="lg" className="stagger-item w-56 justify-center text-base" style={{ "--stagger-index": 0 } as CSSProperties} onClick={onPlay}>
          {hasActiveBattle ? "Resume Run" : "Play"}
        </Button>
        <Button size="lg" variant="outline" className="stagger-item w-56 justify-center text-base" style={{ "--stagger-index": 1 } as CSSProperties} onClick={onCollection}>
          Collection
        </Button>
        <Button size="lg" variant="outline" className="stagger-item w-56 justify-center text-base" style={{ "--stagger-index": 2 } as CSSProperties} onClick={onOptions}>
          Options
        </Button>
        <Button size="lg" variant="outline" className="stagger-item w-56 justify-center text-base" style={{ "--stagger-index": 3 } as CSSProperties} onClick={onTalents}>
          Talents
        </Button>
        {onQuit ? (
          <Button size="lg" variant="outline" className="stagger-item w-56 justify-center text-base" style={{ "--stagger-index": 4 } as CSSProperties} onClick={onQuit}>
            Quit
          </Button>
        ) : null}
      </div>
    </div>
  );
}
