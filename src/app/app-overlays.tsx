import { GameMenu, HamburgerTrigger } from "@/features/alchemy/shared/ui/shared-ui";
import { BackgroundParticles } from "@/features/alchemy/shared/ui/background-particles";
import { flattenGearInventories } from "@/lib/gear";
import { platform } from "@/lib/platform";
import { isRunLoopScreen, type Screen } from "@/lib/routing";
import { UnsupportedSaveVersionScreen } from "@/app/unsupported-save-version-screen";
import { resolveReturnToRunLabel, shouldShowReturnToRun } from "@/app/return-to-run-navigation";
import type { useReturnToRunNavigation } from "@/app/use-return-to-run-navigation";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";

export function AppBackgroundParticles({
  renderedScreen,
  particleColors,
  particleAlphaMultiplier,
}: {
  renderedScreen: Screen;
  particleColors: readonly string[] | undefined;
  particleAlphaMultiplier: number | undefined;
}) {
  if (renderedScreen === "battle") return null;
  return (
    <BackgroundParticles
      variant="embers"
      {...(particleColors ? { colors: particleColors } : {})}
      {...(particleAlphaMultiplier ? { alphaMultiplier: particleAlphaMultiplier } : {})}
    />
  );
}

export function AppHamburgerTrigger({
  renderedScreen,
  onOpenMenu,
}: {
  renderedScreen: Screen;
  onOpenMenu: () => void;
}) {
  if (!isRunLoopScreen(renderedScreen)) return null;
  if (renderedScreen === "battle" || renderedScreen === "labyrinth-map") return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex justify-center">
      <div className="pointer-events-none relative w-full max-w-6xl">
        <div className="pointer-events-auto absolute right-4 top-4">
          <HamburgerTrigger onClick={onOpenMenu} label={`Open ${renderedScreen} menu`} />
        </div>
      </div>
    </div>
  );
}

export function UnsupportedSaveOverlay() {
  return <UnsupportedSaveVersionScreen canQuit={platform.canQuit} onQuit={platform.quit} />;
}

export function useIsArmoryLocked() {
  return useGearStore((s) => flattenGearInventories(s.inventories).length === 0);
}

export function GameMenuOverlay({
  saveBlockedByNewerVersion,
  gameMenuOpen,
  anchorRect,
  currentScreen,
  onClose,
  nav,
  finishedRunCharacters,
  isArmoryLocked,
  onEndRun,
}: {
  saveBlockedByNewerVersion: boolean;
  gameMenuOpen: boolean;
  anchorRect: DOMRect | null;
  currentScreen: Screen;
  onClose: () => void;
  nav: ReturnType<typeof useReturnToRunNavigation>;
  finishedRunCharacters: string[];
  isArmoryLocked: boolean;
  onEndRun: (() => void) | undefined;
}) {
  return (
    <GameMenu
      isOpen={saveBlockedByNewerVersion ? false : gameMenuOpen}
      anchorRect={anchorRect}
      currentScreen={currentScreen}
      onClose={onClose}
      onMainMenu={nav.handleMainMenu}
      onCollection={() => nav.navigateToMeta("collection")}
      onTalents={() => nav.navigateToMeta("talents")}
      onHomestead={() => nav.navigateToMeta("homestead")}
      onArmory={() => nav.navigateToMeta("armory")}
      onOptions={() => nav.navigateToMeta("options")}
      isTalentsLocked={!finishedRunCharacters.includes("knight")}
      isHomesteadLocked={!finishedRunCharacters.includes("knight")}
      isArmoryLocked={isArmoryLocked}
      {...(nav.returnToRunTarget && shouldShowReturnToRun(nav.returnToRunTarget, currentScreen)
        ? {
            onReturnToRun: nav.returnToRun,
            returnToRunLabel: resolveReturnToRunLabel(nav.returnToRunTarget),
          }
        : {})}
      {...(isRunLoopScreen(currentScreen) && onEndRun ? { onEndRun } : {})}
    />
  );
}
