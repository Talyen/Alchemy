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
  ArmoryScreen,
} from "@/features/alchemy/shared/screens";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import { useHomesteadStore } from "@/features/alchemy/shared/stores/homestead-store";
import { useAppActions, useHomesteadActions } from "@/features/alchemy/shared/stores/store-actions";
import { useRunDomainStore } from "@/features/alchemy/shared/stores/run-session-facade";
import type { ScreenRouteContext } from "./types";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";
import { flattenGearInventories } from "@/lib/gear";
import { useArmoryController } from "@/features/alchemy/meta/screens/armory/use-armory-controller";

function MenuScreenRoute({ run }: Pick<ScreenRouteContext, "run">) {
  const { hasUnspentTalents, hasAffordableHomestead } = useAppScreenChrome();
  const isArmoryLocked = useGearStore((s) => flattenGearInventories(s.inventories).length === 0);
  return (
    <MenuScreen
      onPlay={() => run.goToScreen("game-mode-select")}
      onCollection={() => run.goToScreen("collection")}
      onOptions={() => run.goToScreen("options")}
      onHomestead={() => run.goToScreen("homestead")}
      onTalents={() => run.goToScreen("talents")}
      onArmory={() => run.goToScreen("armory")}
      {...(platform.canQuit ? { onQuit: platform.quit } : {})}
      logoSrc={menuLogo}
      logoSrcVariants={menuLogoVariants}
      hasUnspentTalents={hasUnspentTalents}
      hasAffordableHomestead={hasAffordableHomestead}
      isArmoryLocked={isArmoryLocked}
    />
  );
}

function ArmoryScreenRoute({ onOpenBattleMenu }: Pick<ScreenRouteContext, "onOpenBattleMenu">) {
  const controller = useArmoryController();
  return (
    <ArmoryScreen
      inventories={controller.inventories}
      loadouts={controller.loadouts}
      craftingCurrencies={controller.craftingCurrencies}
      onApplyCurrency={controller.onApplyCurrency}
      finishedRunCharacters={controller.finishedRunCharacters}
      browseOnly={controller.browseOnly}
      onOpenMenu={onOpenBattleMenu}
      onEquip={controller.onEquip}
      onUnequip={controller.onUnequip}
      onSalvage={controller.onSalvage}
      onTransferGear={controller.onTransferGear}
      {...(controller.onSpawnDevGear ? { onSpawnDevGear: controller.onSpawnDevGear } : {})}
    />
  );
}

function GameModeSelectScreenRoute({ run }: Pick<ScreenRouteContext, "run">) {
  const hasActiveRun = useRunDomainStore((s) => s.session.hasActiveRun);
  const activeContentSystemType = useRunDomainStore((s) => s.progress.contentSystemType);
  return (
    <GameModeSelectScreen
      hasActiveRun={hasActiveRun}
      activeContentSystemType={activeContentSystemType}
      onSelectCampaign={run.beginCampaign}
      onSelectLabyrinth={run.beginLabyrinth}
      onSelectWildwood={run.beginWildwood}
      onBack={() => run.goToScreen("menu")}
    />
  );
}

function CollectionScreenRoute({ onOpenBattleMenu }: Pick<ScreenRouteContext, "onOpenBattleMenu">) {
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
      onOpenMenu={onOpenBattleMenu}
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

function HomesteadScreenRoute({ onOpenBattleMenu }: Pick<ScreenRouteContext, "onOpenBattleMenu">) {
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
      onOpenMenu={onOpenBattleMenu}
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

function TalentsScreenRoute({ run, onOpenBattleMenu }: Pick<ScreenRouteContext, "run" | "onOpenBattleMenu">) {
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
      onOpenMenu={onOpenBattleMenu}
      onUnlockTalent={run.unlockTalent}
      onResetTalents={run.resetUnlockedTalents}
    />
  );
}

export const metaScreenRoutes: Partial<Record<import("@/lib/routing").Screen, (ctx: ScreenRouteContext) => ReactNode>> =
  {
    menu: ({ run }) => <MenuScreenRoute run={run} />,
    "game-mode-select": ({ run }) => <GameModeSelectScreenRoute run={run} />,
    collection: ({ onOpenBattleMenu }) => <CollectionScreenRoute onOpenBattleMenu={onOpenBattleMenu} />,
    homestead: ({ onOpenBattleMenu }) => <HomesteadScreenRoute onOpenBattleMenu={onOpenBattleMenu} />,
    talents: ({ run, onOpenBattleMenu }) => <TalentsScreenRoute run={run} onOpenBattleMenu={onOpenBattleMenu} />,
    armory: ({ onOpenBattleMenu }) => <ArmoryScreenRoute onOpenBattleMenu={onOpenBattleMenu} />,
  };
