// Main menu screen with logo and navigation buttons. Entry point for all other screens.
import { Button } from "@/components/ui/button";

export function MenuScreen({ onPlay, onCollection, onOptions, onTalents, logoSrc, hasActiveBattle }: { onPlay: () => void; onCollection: () => void; onOptions: () => void; onTalents: () => void; logoSrc: string; hasActiveBattle?: boolean }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 text-center">
      <img src={logoSrc} alt="Alchemy logo" className="w-full max-w-[430px] object-contain" loading="eager" />

      <div className="grid gap-3">
        <Button size="lg" className="w-56 justify-center text-base" onClick={onPlay}>
          {hasActiveBattle ? "Resume Run" : "Play"}
        </Button>
        <Button size="lg" variant="outline" className="w-56 justify-center text-base" onClick={onCollection}>
          Collection
        </Button>
        <Button size="lg" variant="outline" className="w-56 justify-center text-base" onClick={onOptions}>
          Options
        </Button>
        <Button size="lg" variant="outline" className="w-56 justify-center text-base" onClick={onTalents}>
          Talents
        </Button>
        <Button size="lg" variant="outline" className="w-56 justify-center text-base" onClick={() => window.close()}>
          Quit
        </Button>
      </div>
    </div>
  );
}
