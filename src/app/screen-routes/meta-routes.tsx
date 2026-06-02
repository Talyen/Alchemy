import type { ReactNode } from "react";
import { platform } from "@/lib/platform";
import { menuLogo, menuLogoVariants } from "@/lib/game-data";
import {
  CollectionScreen,
  GameModeSelectScreen,
  HomesteadScreen,
  MenuScreen,
  TalentsScreen,
} from "@/features/alchemy/screens";
import type { ScreenRouteContext } from "./types";

export const metaScreenRoutes: Partial<Record<import("@/lib/routing").Screen, (ctx: ScreenRouteContext) => ReactNode>> =
  {
    menu: ({ actions: a, hasUnspentTalents, hasAffordableHomestead }) => (
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
    ),
    "game-mode-select": ({ actions: a, runScreenData: r }) => (
      <GameModeSelectScreen
        hasActiveRun={r.hasActiveRun}
        onSelectCampaign={a.runStart.beginCampaign}
        onSelectLabyrinth={a.runStart.beginLabyrinth}
        onSelectWildwood={a.runStart.beginWildwood}
        onBack={() => a.navigation.goToScreen("menu")}
      />
    ),
    collection: ({ appValues, appActions, homesteadValues, onOpenBattleMenu }) => (
      <CollectionScreen
        onOpenMenu={onOpenBattleMenu}
        collectionTab={appValues.collectionTab}
        onSelectTab={appActions.handleCollectionTabChange}
        onPageChange={appActions.setCollectionPage}
        bondedCompanions={homesteadValues.bondedCompanions}
        discoveredCardIds={appValues.discoveredCardIds}
        encounteredEnemyIds={appValues.encounteredEnemyIds}
        discoveredTrinketIds={appValues.discoveredTrinketIds}
        collectionPages={appValues.collectionPages}
      />
    ),
    homestead: ({ appValues, homesteadValues, homesteadActions, onOpenBattleMenu }) => (
      <HomesteadScreen
        onOpenMenu={onOpenBattleMenu}
        materialInventory={homesteadValues.materialInventory}
        constructedBuildings={homesteadValues.constructedBuildings}
        plantedFarms={homesteadValues.plantedFarms}
        completedResearch={homesteadValues.completedResearch}
        bondedCompanions={homesteadValues.bondedCompanions}
        discoveredCardIds={appValues.discoveredCardIds}
        onConstructBuilding={homesteadActions.constructBuilding}
        onPlantFarm={homesteadActions.plantFarm}
        onCompleteResearch={homesteadActions.completeResearch}
        onBondCompanion={homesteadActions.bondCompanion}
      />
    ),
    talents: ({ actions: a, onOpenBattleMenu, runScreenData: r }) => (
      <TalentsScreen
        talentXP={r.talentXP}
        unlockedTalents={r.unlockedTalents}
        onOpenMenu={onOpenBattleMenu}
        onUnlockTalent={a.meta.unlockTalent}
        onResetTalents={a.meta.resetUnlockedTalents}
      />
    ),
  };
