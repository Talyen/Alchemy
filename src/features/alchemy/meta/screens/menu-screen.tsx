import { useCallback, useState, type ReactNode } from "react";
import { BookOpen, Cog, Shield, Swords, TreePine, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShineBorder } from "@/components/ui/shine-border";
import { BUTTON_WIDTH_MENU } from "@/features/alchemy/shared/config";
import { CardFlip } from "../../shared/ui/card-flip";
import { TiltSurface } from "../../shared/ui/tilt-surface";
import { cn } from "@/lib/utils";
import { LockedMenuItem } from "../../shared/ui/locked-menu-item";
import {
  isProgressionFeatureUnlocked,
  KNIGHT_UNLOCK_MESSAGE,
  type CharacterId,
} from "../../shared/config/game-data-catalog";

function MenuNavButton({ children }: { children: ReactNode }) {
  return <div className="menu-nav-button">{children}</div>;
}

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
  finishedRunCharacters,
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
  finishedRunCharacters: CharacterId[];
}) {
  const variants = logoSrcVariants?.length ? logoSrcVariants : [logoSrc];
  const [variantIdx, setVariantIdx] = useState(() => Math.min(1, variants.length - 1));
  const [flipped, setFlipped] = useState(false);

  const isKnightGatedLocked = !isProgressionFeatureUnlocked("talents", finishedRunCharacters);

  const handleLogoClick = useCallback(() => {
    if (!flipped && variants.length > 2) {
      let next: number;
      do {
        next = 1 + Math.floor(Math.random() * (variants.length - 1));
      } while (next === variantIdx);
      setVariantIdx(next);
    }
    setFlipped((prev) => !prev);
  }, [flipped, variantIdx, variants.length]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-10 text-center">
      <TiltSurface
        className="relative w-full max-w-[47.77cqh] cursor-pointer"
        tiltEnabled
        onDivClick={handleLogoClick}
        ariaLabel="Flip Alchemy logo"
      >
        <CardFlip
          flipped={flipped}
          transition="transform 800ms cubic-bezier(0.16, 1, 0.3, 1)"
          className="aspect-square w-full"
          front={<img src={variants[0]} alt="Alchemy logo" className="w-full object-contain" loading="eager" />}
          back={<img src={variants[variantIdx]} alt="Alchemy logo" className="w-full object-contain" loading="eager" />}
        />
      </TiltSurface>

      <div className="grid gap-2 overflow-visible">
        <MenuNavButton>
          <Button
            size="lg"
            variant="primary"
            className={cn("h-16 justify-center gap-2 text-2xl", BUTTON_WIDTH_MENU)}
            onClick={onPlay}
          >
            <Swords className="h-7 w-7" />
            Play
          </Button>
        </MenuNavButton>
        <MenuNavButton>
          <LockedMenuItem
            title="Talents"
            message={KNIGHT_UNLOCK_MESSAGE}
            locked={isKnightGatedLocked}
            onSelect={onTalents}
            icon={<WandSparkles className="h-7 w-7" />}
            className={cn("h-16 justify-center gap-2 text-2xl", BUTTON_WIDTH_MENU)}
            size="lg"
            variant="outline"
            tooltipPlacement="side-start"
          >
            Talents
          </LockedMenuItem>
          {hasUnspentTalents && !isKnightGatedLocked && (
            <ShineBorder shineColor="var(--color-primary)" borderWidth={1} duration={8} className="rounded-xl" />
          )}
        </MenuNavButton>
        <MenuNavButton>
          <LockedMenuItem
            title="Homestead"
            message={KNIGHT_UNLOCK_MESSAGE}
            locked={isKnightGatedLocked}
            onSelect={onHomestead}
            icon={<TreePine className="h-7 w-7" />}
            className={cn("h-16 justify-center gap-2 text-2xl", BUTTON_WIDTH_MENU)}
            size="lg"
            variant="outline"
            tooltipPlacement="side-start"
          >
            Homestead
          </LockedMenuItem>
          {hasAffordableHomestead && !isKnightGatedLocked && (
            <ShineBorder shineColor="var(--color-primary)" borderWidth={1} duration={8} className="rounded-xl" />
          )}
        </MenuNavButton>
        <MenuNavButton>
          <LockedMenuItem
            title="Armory"
            message="Find Gear to unlock"
            locked={isArmoryLocked}
            onSelect={onArmory}
            icon={<Shield className="h-7 w-7" />}
            className={cn("h-16 justify-center gap-2 text-2xl", BUTTON_WIDTH_MENU)}
            size="lg"
            variant="outline"
            tooltipPlacement="side-start"
          >
            Armory
          </LockedMenuItem>
        </MenuNavButton>
        <MenuNavButton>
          <Button
            size="lg"
            variant="outline"
            className={cn("h-16 justify-center gap-2 text-2xl", BUTTON_WIDTH_MENU)}
            onClick={onCollection}
          >
            <BookOpen className="h-7 w-7" />
            Collection
          </Button>
        </MenuNavButton>
        <MenuNavButton>
          <Button
            size="lg"
            variant="outline"
            className={cn("h-16 justify-center gap-2 text-2xl", BUTTON_WIDTH_MENU)}
            onClick={onOptions}
          >
            <Cog className="h-7 w-7" />
            Options
          </Button>
        </MenuNavButton>
        {onQuit ? (
          <MenuNavButton>
            <Button
              size="lg"
              variant="outline"
              className={cn("h-16 justify-center gap-2 text-2xl", BUTTON_WIDTH_MENU)}
              onClick={onQuit}
            >
              Quit
            </Button>
          </MenuNavButton>
        ) : null}
      </div>
    </div>
  );
}
