import { UI_GOLD } from "@/lib/game-constants/ui-colors";
import { useState, type ReactNode } from "react";
import { BookOpen, Cog, Shield, Swords, TreePine, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShineBorder } from "@/components/ui/shine-border";
import type { PlasmaColorPair } from "@/lib/animation/plasma-colors";
import { cardHoverScaleClass, SHINE_PALETTES } from "@/features/alchemy/shared/config";
import { Surface } from "../../shared/ui/surface";
import { usePlasmaInteraction } from "../../shared/ui/use-plasma-source";
import { cn } from "@/lib/utils";
import { LockedMenuItem } from "../../shared/ui/locked-menu-item";
import {
  getProgressionFeatureUnlockMessage,
  isProgressionFeatureUnlocked,
  type CharacterId,
} from "../../shared/config/game-data-catalog";

const MENU_NAV_BUTTON_CLASS = cn("h-16 justify-center gap-2 text-2xl", "w-[calc(19.2*var(--content-rem,1rem))]");
const MENU_NAV_BUTTON_WRAPPER_CLASS = "w-[calc(19.2*var(--content-rem,1rem))]";

const PLAY_PLASMA_PAIR: PlasmaColorPair = { primary: UI_GOLD.base, secondary: "#251e18" };
const COLLECTION_PLASMA_PAIR: PlasmaColorPair = { primary: UI_GOLD.light, secondary: UI_GOLD.deep };
const HOMESTEAD_PLASMA_PAIR: PlasmaColorPair = { primary: "#34d399", secondary: "#064e3b" };
const ARMORY_PLASMA_PAIR: PlasmaColorPair = { primary: "#7dd3fc", secondary: "#0c4a6e" };
const TALENTS_PLASMA_PAIR: PlasmaColorPair = { primary: "#a78bfa", secondary: "#4c1d95" };
const OPTIONS_PLASMA_PAIR: PlasmaColorPair = { primary: "#a1a1aa", secondary: "#27272a" };

function MenuPlasmaHover({ colorPair, children }: { colorPair: PlasmaColorPair; children: ReactNode }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  usePlasmaInteraction(colorPair, hovered || focused);

  return (
    <div
      className="menu-nav-button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      {children}
    </div>
  );
}

export function MenuScreen({
  onPlay,
  hasActiveRun,
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
  hasActiveRun: boolean;
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
    <div className="flex h-full w-full flex-col items-center justify-center gap-5 py-4 text-center">
      <Surface
        clipContents={false}
        className="relative flex min-h-0 w-full max-w-[calc(49.346*var(--content-rem,1rem))] justify-center"
      >
        <img
          width={1200}
          height={1046}
          src={logoSrc}
          alt="Alchemy logo"
          className={cn("h-full max-h-full w-auto max-w-full object-contain brightness-90", cardHoverScaleClass)}
          loading="eager"
        />
      </Surface>

      <div className="grid shrink-0 justify-items-center gap-3 overflow-visible">
        <MenuPlasmaHover colorPair={PLAY_PLASMA_PAIR}>
          <Button
            size="lg"
            variant="primary"
            wrapperClassName={MENU_NAV_BUTTON_WRAPPER_CLASS}
            className={MENU_NAV_BUTTON_CLASS}
            onClick={onPlay}
          >
            <Swords className="h-7 w-7" />
            {hasActiveRun ? "Continue" : "Play"}
          </Button>
        </MenuPlasmaHover>
        <div className="grid grid-cols-2 gap-3">
          <MenuPlasmaHover colorPair={COLLECTION_PLASMA_PAIR}>
            <Button
              size="lg"
              variant="outline"
              wrapperClassName={MENU_NAV_BUTTON_WRAPPER_CLASS}
              className={MENU_NAV_BUTTON_CLASS}
              onClick={onCollection}
            >
              <BookOpen className="h-7 w-7 text-gold-light" />
              Collection
            </Button>
          </MenuPlasmaHover>
          <MenuPlasmaHover colorPair={HOMESTEAD_PLASMA_PAIR}>
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
              <ShineBorder shineColor={SHINE_PALETTES.gold} borderWidth={2} duration={8} className="rounded-xl" />
            )}
          </MenuPlasmaHover>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MenuPlasmaHover colorPair={TALENTS_PLASMA_PAIR}>
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
              tooltipPlacement="side-start"
            >
              Talents
            </LockedMenuItem>
            {hasUnspentTalents && !isTalentsLocked && (
              <ShineBorder shineColor={SHINE_PALETTES.gold} borderWidth={2} duration={8} className="rounded-xl" />
            )}
          </MenuPlasmaHover>
          <MenuPlasmaHover colorPair={ARMORY_PLASMA_PAIR}>
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
              tooltipPlacement="side-end"
            >
              Armory
            </LockedMenuItem>
          </MenuPlasmaHover>
        </div>
        <MenuPlasmaHover colorPair={OPTIONS_PLASMA_PAIR}>
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
        </MenuPlasmaHover>
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
