/* eslint-disable react-refresh/only-export-components -- overlay components and tiny route helpers are colocated here. */
import { GameMenu } from "@/features/alchemy/shared/ui/shared-ui";
import { BackgroundParticles } from "@/features/alchemy/shared/ui/background-particles";
import { isDesktop, quitDesktopApp } from "@/lib/platform";
import { isRunLoopScreen, type Screen } from "@/lib/routing";
import { UnsupportedSaveVersionScreen } from "@/app/unsupported-save-version-screen";
import type { useReturnToRunNavigation } from "@/app/use-app-navigation";
import { renderAlchemyScreenRoute, type RenderAlchemyScreenProps } from "@/app/screen-routes";
import { isProgressionFeatureUnlocked, type CharacterId } from "@/features/alchemy/shared/config/game-data-catalog";

export function RenderAlchemyScreen(props: RenderAlchemyScreenProps) {
  return renderAlchemyScreenRoute(props);
}

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

export function UnsupportedSaveOverlay({
  onDeleteSaveAndContinue,
  deleting = false,
}: {
  onDeleteSaveAndContinue: () => void;
  deleting?: boolean;
}) {
  return (
    <UnsupportedSaveVersionScreen
      canQuit={isDesktop()}
      onQuit={quitDesktopApp}
      onDeleteSaveAndContinue={onDeleteSaveAndContinue}
      deleting={deleting}
    />
  );
}

export { useIsArmoryLocked } from "@/features/alchemy/shared/stores/gear-store";

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
  finishedRunCharacters: CharacterId[];
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
      isTalentsLocked={!isProgressionFeatureUnlocked("talents", finishedRunCharacters)}
      isHomesteadLocked={!isProgressionFeatureUnlocked("homestead", finishedRunCharacters)}
      isArmoryLocked={isArmoryLocked}
      {...(nav.returnToRunTarget && nav.returnToRunTarget !== currentScreen
        ? {
            onReturnToRun: nav.returnToRun,
            returnToRunLabel: nav.returnToRunTarget === "battle" ? "Return to Battle" : "Return to Run",
          }
        : {})}
      {...(isRunLoopScreen(currentScreen) && onEndRun ? { onEndRun } : {})}
    />
  );
}
