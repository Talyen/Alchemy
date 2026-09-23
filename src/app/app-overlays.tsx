import { useIsArmoryLocked } from "@/features/alchemy/shared/stores/gear-store";
import { useFinishedRunCharacters } from "@/features/alchemy/shared/stores/profile-store";
import { useHasActiveRun } from "@/features/alchemy/shared/stores/run-reads";
import { GameMenu } from "@/features/alchemy/shared/ui/game-menu";
import { BackgroundParticles } from "@/features/alchemy/shared/ui/background-particles";
import { type Screen } from "@/lib/routing";
import type { useReturnToRunNavigation } from "@/app/use-app-navigation";
import { isProgressionFeatureUnlocked } from "@/features/alchemy/shared/config/game-data-catalog";

import { getScreenParticleConfig } from "@/app/screen-particle-config";

export function AppBackgroundParticles({
  renderedScreen,
  backgroundParticlesIntensity = 100,
}: {
  renderedScreen: Screen;
  backgroundParticlesIntensity?: number | undefined;
}) {
  if (renderedScreen === "battle" || renderedScreen === "character-select") return null;
  if (backgroundParticlesIntensity <= 0) return null;
  // App chrome never paints battle particles (battle screen owns boss-aware particles),
  // so `false` is intentional here rather than a missing boss flag.
  const { particleColors, particleAlphaMultiplier, particleCount } = getScreenParticleConfig(renderedScreen, false);
  const effectiveAlphaMultiplier = ((particleAlphaMultiplier ?? 1) * backgroundParticlesIntensity) / 100;
  return (
    <BackgroundParticles
      variant="embers"
      {...(particleColors ? { colors: particleColors } : {})}
      alphaMultiplier={effectiveAlphaMultiplier}
      {...(particleCount !== undefined ? { particleCount } : {})}
    />
  );
}

export function GameMenuOverlay({
  gameMenuOpen,
  anchorRect,
  currentScreen,
  onClose,
  nav,
  onEndRun,
}: {
  gameMenuOpen: boolean;
  anchorRect: DOMRect | null;
  currentScreen: Screen;
  onClose: () => void;
  nav: ReturnType<typeof useReturnToRunNavigation>;
  onEndRun: (() => void) | undefined;
}) {
  const hasActiveRun = useHasActiveRun();
  const finishedRunCharacters = useFinishedRunCharacters();
  const isArmoryLocked = useIsArmoryLocked();
  return (
    <GameMenu
      isOpen={gameMenuOpen}
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
      {...(hasActiveRun && onEndRun ? { onEndRun } : {})}
    />
  );
}
