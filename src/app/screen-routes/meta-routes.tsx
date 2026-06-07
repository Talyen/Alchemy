import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { platform } from "@/lib/platform";
import { menuLogo, menuLogoVariants } from "@/lib/game-data";
import { useAppScreenChrome } from "@/app/app-screen-chrome-context";
import {
  CollectionScreen,
  GameModeSelectScreen,
  HomesteadScreen,
  MenuScreen,
  TalentsScreen,
} from "@/features/alchemy/shared/screens";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import { useHomesteadStore } from "@/features/alchemy/shared/stores/homestead-store";
import { useAppActions, useHomesteadActions } from "@/features/alchemy/shared/stores/store-actions";
import { useRunDomainStore } from "@/features/alchemy/shared/stores/run-session-facade";
import type { ScreenRouteContext } from "./types";

function MenuScreenRoute({ actions: a }: Pick<ScreenRouteContext, "actions">) {
  const { hasUnspentTalents, hasAffordableHomestead } = useAppScreenChrome();
  return (
    <MenuScreen
      onPlay={() => a.navigation.goToScreen("game-mode-select")}
      onCollection={() => a.navigation.goToScreen("collection")}
      onOptions={() => a.navigation.goToScreen("options")}
      onHomestead={() => a.navigation.goToScreen("homestead")}
      onTalents={() => a.navigation.goToScreen("talents")}
      {...(platform.canQuit ? { onQuit: platform.quit } : {})}
      logoSrc={menuLogo}
      logoSrcVariants={menuLogoVariants}
      hasUnspentTalents={hasUnspentTalents}
      hasAffordableHomestead={hasAffordableHomestead}
    />
  );
}

function GameModeSelectScreenRoute({ actions: a }: Pick<ScreenRouteContext, "actions">) {
  const hasActiveRun = useRunDomainStore((s) => s.session.hasActiveRun);
  return (
    <GameModeSelectScreen
      hasActiveRun={hasActiveRun}
      onSelectCampaign={a.runStart.beginCampaign}
      onSelectLabyrinth={a.runStart.beginLabyrinth}
      onSelectWildwood={a.runStart.beginWildwood}
      onBack={() => a.navigation.goToScreen("menu")}
    />
  );
}

function CollectionScreenRoute({ onOpenMenu }: Pick<ScreenRouteContext, "onOpenMenu">) {
  const appValues = useAppStore(
    useShallow((s) => ({
      collectionTab: s.collectionTab,
      discoveredCardIds: s.discoveredCardIds,
      encounteredEnemyIds: s.encounteredEnemyIds,
      discoveredTrinketIds: s.discoveredTrinketIds,
      collectionPages: s.collectionPages,
    })),
  );
  const appActions = useAppActions();
  const bondedCompanions = useHomesteadStore((s) => s.bondedCompanions);

  return (
    <CollectionScreen
      onOpenMenu={onOpenMenu}
      collectionTab={appValues.collectionTab}
      onSelectTab={appActions.handleCollectionTabChange}
      onPageChange={appActions.setCollectionPage}
      bondedCompanions={bondedCompanions}
      discoveredCardIds={appValues.discoveredCardIds}
      encounteredEnemyIds={appValues.encounteredEnemyIds}
      discoveredTrinketIds={appValues.discoveredTrinketIds}
      collectionPages={appValues.collectionPages}
    />
  );
}

function HomesteadScreenRoute({ onOpenMenu }: Pick<ScreenRouteContext, "onOpenMenu">) {
  const homesteadValues = useHomesteadStore(
    useShallow((s) => ({
      materialInventory: s.materialInventory,
      constructedBuildings: s.constructedBuildings,
      plantedFarms: s.plantedFarms,
      completedResearch: s.completedResearch,
      bondedCompanions: s.bondedCompanions,
    })),
  );
  const discoveredCardIds = useAppStore((s) => s.discoveredCardIds);
  const homesteadActions = useHomesteadActions();

  return (
    <HomesteadScreen
      onOpenMenu={onOpenMenu}
      materialInventory={homesteadValues.materialInventory}
      constructedBuildings={homesteadValues.constructedBuildings}
      plantedFarms={homesteadValues.plantedFarms}
      completedResearch={homesteadValues.completedResearch}
      bondedCompanions={homesteadValues.bondedCompanions}
      discoveredCardIds={discoveredCardIds}
      onConstructBuilding={homesteadActions.constructBuilding}
      onPlantFarm={homesteadActions.plantFarm}
      onCompleteResearch={homesteadActions.completeResearch}
      onBondCompanion={homesteadActions.bondCompanion}
    />
  );
}

function TalentsScreenRoute({ actions: a, onOpenMenu }: Pick<ScreenRouteContext, "actions" | "onOpenMenu">) {
  const { talentXP, unlockedTalents } = useRunDomainStore(
    useShallow((s) => ({
      talentXP: s.progress.talentXP,
      unlockedTalents: s.progress.unlockedTalents,
    })),
  );

  return (
    <TalentsScreen
      talentXP={talentXP}
      unlockedTalents={unlockedTalents}
      onOpenMenu={onOpenMenu}
      onUnlockTalent={a.meta.unlockTalent}
      onResetTalents={a.meta.resetUnlockedTalents}
    />
  );
}

export const metaScreenRoutes: Partial<Record<import("@/lib/routing").Screen, (ctx: ScreenRouteContext) => ReactNode>> =
  {
    menu: ({ actions: a }) => <MenuScreenRoute actions={a} />,
    "game-mode-select": ({ actions: a }) => <GameModeSelectScreenRoute actions={a} />,
    collection: ({ onOpenMenu }) => <CollectionScreenRoute onOpenMenu={onOpenMenu} />,
    homestead: ({ onOpenMenu }) => <HomesteadScreenRoute onOpenMenu={onOpenMenu} />,
    talents: ({ actions: a, onOpenMenu }) => <TalentsScreenRoute actions={a} onOpenMenu={onOpenMenu} />,
  };
