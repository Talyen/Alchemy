import { GameMessage } from "@/components/localization";
import { useGameTranslation } from "@/components/use-game-translation";
import { UI_GOLD } from "@/lib/game-constants/ui-colors";
import { useState, type ReactNode } from "react";
import { BookOpen, Cog, Power, Shield, Swords, TreePine, WandSparkles } from "lucide-react";
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
  useGameTranslation();
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
  onWishlist,
  logoSrc,
  hasUnspentTalents = false,
  hasAffordableHomestead = false,
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
  onWishlist?: () => void;
  logoSrc: string;
  hasUnspentTalents?: boolean;
  hasAffordableHomestead?: boolean;
  finishedRunCharacters: CharacterId[];
}) {
  const i18n = useGameTranslation();
  const isTalentsLocked = !isProgressionFeatureUnlocked("talents", finishedRunCharacters);
  const isHomesteadLocked = !isProgressionFeatureUnlocked("homestead", finishedRunCharacters);
  const optionsButton = (
    <MenuPlasmaHover colorPair={OPTIONS_PLASMA_PAIR}>
      <Button
        size="lg"
        variant="outline"
        wrapperClassName={MENU_NAV_BUTTON_WRAPPER_CLASS}
        className={MENU_NAV_BUTTON_CLASS}
        onClick={onOptions}
      >
        <GameMessage
          id="ui.menu-screen.s1"
          defaultValue="<part0/>Options"
          parts={{ part0: <Cog className="h-7 w-7 text-zinc-400" /> }}
        />
      </Button>
    </MenuPlasmaHover>
  );

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
          alt={i18n.text("ui.menu-screen.2", "Alchemy logo")}
          className={cn("h-full max-h-full w-auto max-w-full object-contain brightness-90", cardHoverScaleClass)}
          loading="eager"
          decoding="async"
        />
      </Surface>

      <div className="grid shrink-0 justify-items-center gap-3 overflow-visible">
        {onWishlist ? (
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="outline" onClick={onWishlist}>
              {i18n.text("ui.menu-screen.3", "Wishlist on Steam")}
            </Button>
          </div>
        ) : null}

        <MenuPlasmaHover colorPair={PLAY_PLASMA_PAIR}>
          <Button
            size="lg"
            variant="primary"
            wrapperClassName={MENU_NAV_BUTTON_WRAPPER_CLASS}
            className={MENU_NAV_BUTTON_CLASS}
            onClick={onPlay}
          >
            <Swords className="h-7 w-7" />
            {i18n.displayText(
              hasActiveRun ? i18n.text("ui.menu-screen.d1", "Continue") : i18n.text("ui.menu-screen.d2", "Play"),
            )}
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
              <GameMessage
                id="ui.menu-screen.s2"
                defaultValue="<part0/>Collection"
                parts={{ part0: <BookOpen className="h-7 w-7 text-gold-light" /> }}
              />
            </Button>
          </MenuPlasmaHover>
          <MenuPlasmaHover colorPair={HOMESTEAD_PLASMA_PAIR}>
            <LockedMenuItem
              title={i18n.text("ui.menu-screen.5", "Homestead")}
              message={i18n.displayText(getProgressionFeatureUnlockMessage("homestead"))}
              locked={isHomesteadLocked}
              onSelect={onHomestead}
              icon={<TreePine className="h-7 w-7 text-emerald-400" />}
              wrapperClassName={MENU_NAV_BUTTON_WRAPPER_CLASS}
              className={MENU_NAV_BUTTON_CLASS}
              size="lg"
              variant="outline"
              tooltipPlacement="side-end"
            >
              {i18n.text("ui.menu-screen.6", "Homestead")}
            </LockedMenuItem>
            {hasAffordableHomestead && !isHomesteadLocked && (
              <ShineBorder shineColor={SHINE_PALETTES.gold} borderWidth={2} duration={8} className="rounded-xl" />
            )}
          </MenuPlasmaHover>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MenuPlasmaHover colorPair={TALENTS_PLASMA_PAIR}>
            <LockedMenuItem
              title={i18n.text("ui.menu-screen.7", "Talents")}
              message={i18n.displayText(getProgressionFeatureUnlockMessage("talents"))}
              locked={isTalentsLocked}
              onSelect={onTalents}
              icon={<WandSparkles className="h-7 w-7 text-violet-400" />}
              wrapperClassName={MENU_NAV_BUTTON_WRAPPER_CLASS}
              className={MENU_NAV_BUTTON_CLASS}
              size="lg"
              variant="outline"
              tooltipPlacement="side-start"
            >
              {i18n.text("ui.menu-screen.8", "Talents")}
            </LockedMenuItem>
            {hasUnspentTalents && !isTalentsLocked && (
              <ShineBorder shineColor={SHINE_PALETTES.gold} borderWidth={2} duration={8} className="rounded-xl" />
            )}
          </MenuPlasmaHover>
          <MenuPlasmaHover colorPair={ARMORY_PLASMA_PAIR}>
            <Button
              size="lg"
              variant="outline"
              wrapperClassName={MENU_NAV_BUTTON_WRAPPER_CLASS}
              className={MENU_NAV_BUTTON_CLASS}
              onClick={onArmory}
            >
              <GameMessage
                id="ui.menu-screen.s3"
                defaultValue="<part0/>Armory"
                parts={{ part0: <Shield className="h-7 w-7 text-sky-300" /> }}
              />
            </Button>
          </MenuPlasmaHover>
        </div>
        {onQuit ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="menu-nav-button">
              <Button
                size="lg"
                variant="outline"
                wrapperClassName={MENU_NAV_BUTTON_WRAPPER_CLASS}
                className={MENU_NAV_BUTTON_CLASS}
                onClick={onQuit}
              >
                <GameMessage
                  id="ui.menu-screen.s4"
                  defaultValue="<part0/>Quit"
                  parts={{ part0: <Power className="h-7 w-7 text-rose-400" /> }}
                />
              </Button>
            </div>
            {i18n.displayText(optionsButton)}
          </div>
        ) : (
          optionsButton
        )}
      </div>
    </div>
  );
}
