import { useCallback, useState } from "react";
import { BookOpen, Cog, Shield, Swords, TreePine, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShineBorder } from "@/components/ui/shine-border";
import { BUTTON_WIDTH_MENU, cardHoverScaleClass } from "@/features/alchemy/shared/config";
import { CardFlip } from "../../shared/ui/card-flip";
import { Surface } from "../../shared/ui/surface";
import { cn } from "@/lib/utils";
import { LockedMenuItem } from "../../shared/ui/locked-menu-item";
import {
  getProgressionFeatureUnlockMessage,
  isProgressionFeatureUnlocked,
  type CharacterId,
} from "../../shared/config/game-data-catalog";

const MENU_NAV_BUTTON_CLASS = cn("h-16 justify-center gap-2 text-2xl", BUTTON_WIDTH_MENU);
const MENU_NAV_BUTTON_WRAPPER_CLASS = BUTTON_WIDTH_MENU;

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

  const isTalentsLocked = !isProgressionFeatureUnlocked("talents", finishedRunCharacters);
  const isHomesteadLocked = !isProgressionFeatureUnlocked("homestead", finishedRunCharacters);

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
      <Surface
        className={cn("relative w-full max-w-[47.77cqh] cursor-pointer", cardHoverScaleClass)}
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
      </Surface>

      <div className="grid gap-2 overflow-visible">
        <div className="menu-nav-button">
          <Button
            size="lg"
            variant="primary"
            wrapperClassName={MENU_NAV_BUTTON_WRAPPER_CLASS}
            className={MENU_NAV_BUTTON_CLASS}
            onClick={onPlay}
          >
            <Swords className="h-7 w-7" />
            Play
          </Button>
        </div>
        <div className="menu-nav-button">
          <LockedMenuItem
            title="Talents"
            message={getProgressionFeatureUnlockMessage("talents")}
            locked={isTalentsLocked}
            onSelect={onTalents}
            icon={<WandSparkles className="h-7 w-7" />}
            wrapperClassName={MENU_NAV_BUTTON_WRAPPER_CLASS}
            className={MENU_NAV_BUTTON_CLASS}
            size="lg"
            variant="outline"
            tooltipPlacement="side-start"
          >
            Talents
          </LockedMenuItem>
          {hasUnspentTalents && !isTalentsLocked && (
            <ShineBorder shineColor="var(--color-primary)" borderWidth={1} duration={8} className="rounded-xl" />
          )}
        </div>
        <div className="menu-nav-button">
          <LockedMenuItem
            title="Homestead"
            message={getProgressionFeatureUnlockMessage("homestead")}
            locked={isHomesteadLocked}
            onSelect={onHomestead}
            icon={<TreePine className="h-7 w-7" />}
            wrapperClassName={MENU_NAV_BUTTON_WRAPPER_CLASS}
            className={MENU_NAV_BUTTON_CLASS}
            size="lg"
            variant="outline"
            tooltipPlacement="side-start"
          >
            Homestead
          </LockedMenuItem>
          {hasAffordableHomestead && !isHomesteadLocked && (
            <ShineBorder shineColor="var(--color-primary)" borderWidth={1} duration={8} className="rounded-xl" />
          )}
        </div>
        <div className="menu-nav-button">
          <LockedMenuItem
            title="Armory"
            message="Find Gear to unlock"
            locked={isArmoryLocked}
            onSelect={onArmory}
            icon={<Shield className="h-7 w-7" />}
            wrapperClassName={MENU_NAV_BUTTON_WRAPPER_CLASS}
            className={MENU_NAV_BUTTON_CLASS}
            size="lg"
            variant="outline"
            tooltipPlacement="side-start"
          >
            Armory
          </LockedMenuItem>
        </div>
        <div className="menu-nav-button">
          <Button
            size="lg"
            variant="outline"
            wrapperClassName={MENU_NAV_BUTTON_WRAPPER_CLASS}
            className={MENU_NAV_BUTTON_CLASS}
            onClick={onCollection}
          >
            <BookOpen className="h-7 w-7" />
            Collection
          </Button>
        </div>
        <div className="menu-nav-button">
          <Button
            size="lg"
            variant="outline"
            wrapperClassName={MENU_NAV_BUTTON_WRAPPER_CLASS}
            className={MENU_NAV_BUTTON_CLASS}
            onClick={onOptions}
          >
            <Cog className="h-7 w-7" />
            Options
          </Button>
        </div>
        {onQuit ? (
          <div className="menu-nav-button">
            <Button
              size="lg"
              variant="outline"
              wrapperClassName={MENU_NAV_BUTTON_WRAPPER_CLASS}
              className={MENU_NAV_BUTTON_CLASS}
              onClick={onQuit}
            >
              Quit
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
