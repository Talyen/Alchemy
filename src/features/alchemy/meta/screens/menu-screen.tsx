import { BookOpen, Cog, Shield, Swords, TreePine, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShineBorder } from "@/components/ui/shine-border";
import { BUTTON_WIDTH_MENU, cardHoverScaleClass } from "@/features/alchemy/shared/config";
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
  hasUnspentTalents?: boolean;
  hasAffordableHomestead?: boolean;
  isArmoryLocked?: boolean;
  finishedRunCharacters: CharacterId[];
}) {
  const isTalentsLocked = !isProgressionFeatureUnlocked("talents", finishedRunCharacters);
  const isHomesteadLocked = !isProgressionFeatureUnlocked("homestead", finishedRunCharacters);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-10 text-center">
      <Surface className={cn("relative w-full max-w-[47.77cqh]", cardHoverScaleClass)}>
        <img src={logoSrc} alt="Alchemy logo" className="h-auto w-full" loading="eager" />
      </Surface>

      <div className="grid justify-items-center gap-3 overflow-visible">
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
        <div className="grid grid-cols-2 gap-3">
          <div className="menu-nav-button">
            <Button
              size="lg"
              variant="outline"
              wrapperClassName={MENU_NAV_BUTTON_WRAPPER_CLASS}
              className={MENU_NAV_BUTTON_CLASS}
              onClick={onCollection}
            >
              <BookOpen className="h-7 w-7 text-amber-300" />
              Collection
            </Button>
          </div>
          <div className="menu-nav-button">
            <LockedMenuItem
              title="Homestead"
              message={getProgressionFeatureUnlockMessage("homestead")}
              locked={isHomesteadLocked}
              onSelect={onHomestead}
              icon={<TreePine className="h-7 w-7 text-emerald-400" />}
              wrapperClassName={MENU_NAV_BUTTON_WRAPPER_CLASS}
              className={MENU_NAV_BUTTON_CLASS}
              size="lg"
              variant="outline"
              tooltipPlacement="side-end"
            >
              Homestead
            </LockedMenuItem>
            {hasAffordableHomestead && !isHomesteadLocked && (
              <ShineBorder shineColor="var(--color-primary)" borderWidth={1} duration={8} className="rounded-xl" />
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="menu-nav-button">
            <LockedMenuItem
              title="Armory"
              message="Find Gear to unlock"
              locked={isArmoryLocked}
              onSelect={onArmory}
              icon={<Shield className="h-7 w-7 text-sky-300" />}
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
            <LockedMenuItem
              title="Talents"
              message={getProgressionFeatureUnlockMessage("talents")}
              locked={isTalentsLocked}
              onSelect={onTalents}
              icon={<WandSparkles className="h-7 w-7 text-violet-400" />}
              wrapperClassName={MENU_NAV_BUTTON_WRAPPER_CLASS}
              className={MENU_NAV_BUTTON_CLASS}
              size="lg"
              variant="outline"
              tooltipPlacement="side-end"
            >
              Talents
            </LockedMenuItem>
            {hasUnspentTalents && !isTalentsLocked && (
              <ShineBorder shineColor="var(--color-primary)" borderWidth={1} duration={8} className="rounded-xl" />
            )}
          </div>
        </div>
        <div className="menu-nav-button">
          <Button
            size="lg"
            variant="outline"
            wrapperClassName={MENU_NAV_BUTTON_WRAPPER_CLASS}
            className={MENU_NAV_BUTTON_CLASS}
            onClick={onOptions}
          >
            <Cog className="h-7 w-7 text-zinc-400" />
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
