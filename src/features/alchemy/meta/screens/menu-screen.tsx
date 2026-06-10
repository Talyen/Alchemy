// Main menu screen with logo and navigation buttons. Entry point for all other screens.
import { useCallback, useState } from "react";
import type { CSSProperties } from "react";
import { BookOpen, Cog, Swords, TreePine, WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ShineBorder } from "@/components/ui/shine-border";
import { CardFlip } from "../../shared/ui/card-flip";
import { staticCardTransform } from "@/features/alchemy/shared/config";
import { clearTiltFromEvent, setTiltFromEvent } from "../../shared/utils";
import { cn } from "@/lib/utils";
import { useAppStore } from "../../shared/stores/app-store";
import { playUISound } from "@/lib/audio";
import { TooltipBody, TooltipHeader, TooltipPanel, useTooltipFlip } from "../../shared/ui/tooltip-panel";

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

  const finishedRunCharacters = useAppStore((s) => s.finishedRunCharacters);
  const isLocked = !finishedRunCharacters.includes("knight");

  const [showTalentsTooltip, setShowTalentsTooltip] = useState(false);
  const { ref: talentsTooltipRef } = useTooltipFlip(showTalentsTooltip);

  const [showHomesteadTooltip, setShowHomesteadTooltip] = useState(false);
  const { ref: homesteadTooltipRef } = useTooltipFlip(showHomesteadTooltip);

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
        <div
          className="relative"
          onMouseEnter={() => isLocked && setShowTalentsTooltip(true)}
          onMouseLeave={() => setShowTalentsTooltip(false)}
        >
          <Button
            size="lg"
            variant="outline"
            className={cn(
              "stagger-item justify-center gap-2 w-56 text-base",
              isLocked && "opacity-50 hover:bg-background cursor-not-allowed",
            )}
            style={{ "--stagger-index": 2 } as CSSProperties}
            onClick={() => {
              if (isLocked) {
                playUISound("error");
              } else {
                onTalents();
              }
            }}
          >
            <WandSparkles className="h-4 w-4" />
            Talents
          </Button>
          {hasUnspentTalents && !isLocked && (
            <ShineBorder shineColor="hsl(var(--primary))" borderWidth={1} duration={8} className="rounded-xl" />
          )}
          {showTalentsTooltip && isLocked && (
            <TooltipPanel
              width="w-64"
              ref={talentsTooltipRef}
              className="z-50 absolute left-full ml-4 top-1/2 -translate-y-1/2 text-left"
            >
              <TooltipHeader>Talents Locked</TooltipHeader>
              <TooltipBody>
                <p className="text-red-400 font-semibold">Finish a Run as the Knight to unlock</p>
              </TooltipBody>
            </TooltipPanel>
          )}
        </div>
        <div
          className="relative"
          onMouseEnter={() => isLocked && setShowHomesteadTooltip(true)}
          onMouseLeave={() => setShowHomesteadTooltip(false)}
        >
          <Button
            size="lg"
            variant="outline"
            className={cn(
              "stagger-item justify-center gap-2 w-56 text-base",
              isLocked && "opacity-50 hover:bg-background cursor-not-allowed",
            )}
            style={{ "--stagger-index": 3 } as CSSProperties}
            onClick={() => {
              if (isLocked) {
                playUISound("error");
              } else {
                onHomestead();
              }
            }}
          >
            <TreePine className="h-4 w-4" />
            Homestead
          </Button>
          {hasAffordableHomestead && !isLocked && (
            <ShineBorder shineColor="hsl(var(--primary))" borderWidth={1} duration={8} className="rounded-xl" />
          )}
          {showHomesteadTooltip && isLocked && (
            <TooltipPanel
              width="w-64"
              ref={homesteadTooltipRef}
              className="z-50 absolute left-full ml-4 top-1/2 -translate-y-1/2 text-left"
            >
              <TooltipHeader>Homestead Locked</TooltipHeader>
              <TooltipBody>
                <p className="text-red-400 font-semibold">Finish a Run as the Knight to unlock</p>
              </TooltipBody>
            </TooltipPanel>
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
