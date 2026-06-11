// Main menu screen with logo and navigation buttons. Entry point for all other screens.
import { useCallback, useState } from "react";
import { BookOpen, Cog, Swords, TreePine, WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ShineBorder } from "@/components/ui/shine-border";
import { CardFlip } from "../../shared/ui/card-flip";
import { TiltSurface } from "../../shared/ui/tilt-surface";
import { cn } from "@/lib/utils";
import { useAppStore } from "../../shared/stores/app-store";
import { playUISound } from "@/lib/audio";
import { TooltipBody, TooltipHeader, TooltipPanel, useTooltipFlip } from "../../shared/ui/tooltip-panel";
import { StaggerGroup, StaggerItem } from "../../shared/ui/shared-ui";
import { TalentsLockedTooltip } from "../talents/talents-locked-tooltip";

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
      <TiltSurface
        className="relative w-full max-w-[39.81cqh] cursor-pointer"
        onDivClick={handleLogoClick}
        ariaLabel="Flip Alchemy logo"
      >
        <CardFlip
          flipped={flipped}
          transition="transform 800ms cubic-bezier(0.16, 1, 0.3, 1)"
          className="w-full aspect-square"
          front={<img src={variants[0]} alt="Alchemy logo" className="w-full object-contain" loading="eager" />}
          back={<img src={variants[variantIdx]} alt="Alchemy logo" className="w-full object-contain" loading="eager" />}
        />
      </TiltSurface>

      <StaggerGroup className="grid gap-2">
        <StaggerItem index={0}>
          <Button size="lg" className="justify-center gap-2 w-56 text-base" onClick={onPlay}>
            <Swords className="h-4 w-4" />
            Play
          </Button>
        </StaggerItem>
        <StaggerItem index={1}>
          <Button size="lg" variant="outline" className="justify-center gap-2 w-56 text-base" onClick={onCollection}>
            <BookOpen className="h-4 w-4" />
            Collection
          </Button>
        </StaggerItem>
        <StaggerItem
          index={2}
          className="relative"
          onMouseEnter={() => isLocked && setShowTalentsTooltip(true)}
          onMouseLeave={() => setShowTalentsTooltip(false)}
        >
          <Button
            size="lg"
            variant="outline"
            className={cn(
              "justify-center gap-2 w-56 text-base",
              isLocked && "opacity-45 grayscale-[50%] hover:bg-background cursor-not-allowed",
            )}
            disableHoverScale={isLocked}
            {...(isLocked ? { hoverSound: false as const } : {})}
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
            <TalentsLockedTooltip
              panelRef={talentsTooltipRef}
              visible
              placement="side-start"
              className="z-50 absolute left-full ml-4 top-1/2 text-left"
            />
          )}
        </StaggerItem>
        <StaggerItem
          index={3}
          className="relative"
          onMouseEnter={() => isLocked && setShowHomesteadTooltip(true)}
          onMouseLeave={() => setShowHomesteadTooltip(false)}
        >
          <Button
            size="lg"
            variant="outline"
            className={cn(
              "justify-center gap-2 w-56 text-base",
              isLocked && "opacity-45 grayscale-[50%] hover:bg-background cursor-not-allowed",
            )}
            disableHoverScale={isLocked}
            {...(isLocked ? { hoverSound: false as const } : {})}
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
              visible
              placement="side-start"
              className="z-50 absolute left-full ml-4 top-1/2 text-left"
            >
              <TooltipHeader>Homestead Locked</TooltipHeader>
              <TooltipBody>
                <p className="text-red-400 font-semibold">Finish a Run as the Knight to unlock</p>
              </TooltipBody>
            </TooltipPanel>
          )}
        </StaggerItem>
        <StaggerItem index={4}>
          <Button size="lg" variant="outline" className="justify-center gap-2 w-56 text-base" onClick={onOptions}>
            <Cog className="h-4 w-4" />
            Options
          </Button>
        </StaggerItem>
        {onQuit ? (
          <StaggerItem index={5}>
            <Button size="lg" variant="outline" className="justify-center gap-2 w-56 text-base" onClick={onQuit}>
              Quit
            </Button>
          </StaggerItem>
        ) : null}
      </StaggerGroup>
    </div>
  );
}
