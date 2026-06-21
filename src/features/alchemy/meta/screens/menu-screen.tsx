// Main menu screen with logo and navigation buttons. Entry point for all other screens.
import { useCallback, useState } from "react";
import { BookOpen, Cog, Shield, Swords, TreePine, WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ShineBorder } from "@/components/ui/shine-border";
import { BUTTON_WIDTH_MENU } from "@/features/alchemy/shared/config";
import { CardFlip } from "../../shared/ui/card-flip";
import { TiltSurface } from "../../shared/ui/tilt-surface";
import { cn } from "@/lib/utils";
import { useAppStore } from "../../shared/stores/app-store";
import { StaggerGroup, StaggerItem } from "../../shared/ui/shared-ui";
import { LockedMenuItem } from "../../shared/ui/locked-menu-item";

import { KNIGHT_UNLOCK_MESSAGE } from "@/lib/game-data/character-unlocks";

export function MenuScreen({
  onPlay,
  onCollection,
  onOptions,
  onTalents,
  onHomestead,
  onArmory,
  onQuit,
  logoSrc,
  logoSrcVariants,
  hasUnspentTalents = false,
  hasAffordableHomestead = false,
  isArmoryLocked = false,
}: {
  onPlay: () => void;
  onCollection: () => void;
  onOptions: () => void;
  onTalents: () => void;
  onHomestead: () => void;
  onArmory: () => void;
  onQuit?: () => void;
  logoSrc: string;
  logoSrcVariants?: string[];
  hasUnspentTalents?: boolean;
  hasAffordableHomestead?: boolean;
  isArmoryLocked?: boolean;
}) {
  const variants = logoSrcVariants ?? [logoSrc];
  const [variantIdx, setVariantIdx] = useState(1);
  const [flipped, setFlipped] = useState(false);

  const finishedRunCharacters = useAppStore((s) => s.finishedRunCharacters);
  const isKnightGatedLocked = !finishedRunCharacters.includes("knight");

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
          <Button
            size="lg"
            variant="primary"
            className={cn("justify-center gap-2 text-base", BUTTON_WIDTH_MENU)}
            onClick={onPlay}
          >
            <Swords className="h-4 w-4" />
            Play
          </Button>
        </StaggerItem>
        <StaggerItem index={1}>
          <Button
            size="lg"
            variant="outline"
            className={cn("justify-center gap-2 text-base", BUTTON_WIDTH_MENU)}
            onClick={onCollection}
          >
            <BookOpen className="h-4 w-4" />
            Collection
          </Button>
        </StaggerItem>
        <StaggerItem index={2} className="relative">
          <LockedMenuItem
            title="Talents"
            message={KNIGHT_UNLOCK_MESSAGE}
            locked={isKnightGatedLocked}
            onSelect={onTalents}
            icon={<WandSparkles className="h-4 w-4" />}
            className={cn("justify-center gap-2 text-base", BUTTON_WIDTH_MENU)}
            size="lg"
            variant="outline"
            tooltipPlacement="side-start"
          >
            Talents
          </LockedMenuItem>
          {hasUnspentTalents && !isKnightGatedLocked && (
            <ShineBorder shineColor="var(--color-primary)" borderWidth={1} duration={8} className="rounded-xl" />
          )}
        </StaggerItem>
        <StaggerItem index={3} className="relative">
          <LockedMenuItem
            title="Homestead"
            message={KNIGHT_UNLOCK_MESSAGE}
            locked={isKnightGatedLocked}
            onSelect={onHomestead}
            icon={<TreePine className="h-4 w-4" />}
            className={cn("justify-center gap-2 text-base", BUTTON_WIDTH_MENU)}
            size="lg"
            variant="outline"
            tooltipPlacement="side-start"
          >
            Homestead
          </LockedMenuItem>
          {hasAffordableHomestead && !isKnightGatedLocked && (
            <ShineBorder shineColor="var(--color-primary)" borderWidth={1} duration={8} className="rounded-xl" />
          )}
        </StaggerItem>
        <StaggerItem index={4} className="relative">
          <LockedMenuItem
            title="Armory"
            message="Find Gear to unlock"
            locked={isArmoryLocked}
            onSelect={onArmory}
            icon={<Shield className="h-4 w-4" />}
            className={cn("justify-center gap-2 text-base", BUTTON_WIDTH_MENU)}
            size="lg"
            variant="outline"
            tooltipPlacement="side-start"
          >
            Armory
          </LockedMenuItem>
        </StaggerItem>
        <StaggerItem index={5}>
          <Button
            size="lg"
            variant="outline"
            className={cn("justify-center gap-2 text-base", BUTTON_WIDTH_MENU)}
            onClick={onOptions}
          >
            <Cog className="h-4 w-4" />
            Options
          </Button>
        </StaggerItem>
        {onQuit ? (
          <StaggerItem index={6}>
            <Button
              size="lg"
              variant="outline"
              className={cn("justify-center gap-2 text-base", BUTTON_WIDTH_MENU)}
              onClick={onQuit}
            >
              Quit
            </Button>
          </StaggerItem>
        ) : null}
      </StaggerGroup>
    </div>
  );
}
