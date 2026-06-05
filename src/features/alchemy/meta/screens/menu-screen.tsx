// Main menu screen with logo and navigation buttons. Entry point for all other screens.
import { useCallback, useState } from "react";
import type { CSSProperties } from "react";
import { BookOpen, Cog, Swords, TreePine, WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ShineBorder } from "@/components/ui/shine-border";
import { CardFlip } from "../../shared/ui/card-flip";
import { staticCardTransform } from "@/features/alchemy/shared/config";
import { clearTiltFromEvent, setTiltFromEvent } from "../../shared/utils";

export function MenuScreen({
  onPlay,
  onCollection,
  onOptions,
  onTalents,
  onHomestead,
  onQuit,
  logoSrc,
  logoSrcVariants,
  hasUnspentTalents = false,
  hasAffordableHomestead = false,
}: {
  onPlay: () => void;
  onCollection: () => void;
  onOptions: () => void;
  onTalents: () => void;
  onHomestead: () => void;
  onQuit?: () => void;
  logoSrc: string;
  logoSrcVariants?: string[];
  hasUnspentTalents?: boolean;
  hasAffordableHomestead?: boolean;
}) {
  const variants = logoSrcVariants ?? [logoSrc];
  const [variantIdx, setVariantIdx] = useState(1);
  const [flipped, setFlipped] = useState(false);

  const handleLogoClick = useCallback(() => {
    if (!flipped) {
      let next: number;
      do {
        next = 1 + Math.floor(Math.random() * (variants.length - 1));
      } while (next === variantIdx);
      setVariantIdx(next);
    }
    setFlipped((prev) => !prev);
  }, [flipped, variantIdx, variants.length]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center text-center gap-8">
      <div
        className="tilt-surface relative w-full max-w-[39.81cqh]"
        style={{ "--card-base-transform": staticCardTransform } as CSSProperties}
        onMouseMove={setTiltFromEvent}
        onMouseLeave={clearTiltFromEvent}
        onClick={handleLogoClick}
      >
        <CardFlip
          flipped={flipped}
          transition="transform 800ms cubic-bezier(0.16, 1, 0.3, 1)"
          className="w-full aspect-square"
          front={<img src={variants[0]} alt="Alchemy logo" className="w-full object-contain" loading="eager" />}
          back={<img src={variants[variantIdx]} alt="Alchemy logo" className="w-full object-contain" loading="eager" />}
        />
      </div>

      <div className="grid gap-2">
        <Button
          size="lg"
          className="stagger-item justify-center gap-2 w-56 text-base"
          style={{ "--stagger-index": 0 } as CSSProperties}
          onClick={onPlay}
        >
          <Swords className="h-4 w-4" />
          Play
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="stagger-item justify-center gap-2 w-56 text-base"
          style={{ "--stagger-index": 1 } as CSSProperties}
          onClick={onCollection}
        >
          <BookOpen className="h-4 w-4" />
          Collection
        </Button>
        <div className="relative">
          <Button
            size="lg"
            variant="outline"
            className="stagger-item justify-center gap-2 w-56 text-base"
            style={{ "--stagger-index": 2 } as CSSProperties}
            onClick={onTalents}
          >
            <WandSparkles className="h-4 w-4" />
            Talents
          </Button>
          {hasUnspentTalents && (
            <ShineBorder shineColor="hsl(var(--primary))" borderWidth={1} duration={8} className="rounded-xl" />
          )}
        </div>
        <div className="relative">
          <Button
            size="lg"
            variant="outline"
            className="stagger-item justify-center gap-2 w-56 text-base"
            style={{ "--stagger-index": 3 } as CSSProperties}
            onClick={onHomestead}
          >
            <TreePine className="h-4 w-4" />
            Homestead
          </Button>
          {hasAffordableHomestead && (
            <ShineBorder shineColor="hsl(var(--primary))" borderWidth={1} duration={8} className="rounded-xl" />
          )}
        </div>
        <Button
          size="lg"
          variant="outline"
          className="stagger-item justify-center gap-2 w-56 text-base"
          style={{ "--stagger-index": 4 } as CSSProperties}
          onClick={onOptions}
        >
          <Cog className="h-4 w-4" />
          Options
        </Button>
        {onQuit ? (
          <Button
            size="lg"
            variant="outline"
            className="stagger-item justify-center gap-2 w-56 text-base"
            style={{ "--stagger-index": 5 } as CSSProperties}
            onClick={onQuit}
          >
            Quit
          </Button>
        ) : null}
      </div>
    </div>
  );
}
