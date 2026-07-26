import type { ReactNode } from "react";
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
} from "@/features/alchemy/meta/screens";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";

import { useAppActions, useHomesteadActions } from "@/features/alchemy/shared/stores/store-actions";
import {
  useBondedCompanions,
  useContentSystemType,
  useHasActiveRun,
  useHomesteadProgressSlice,
  useTalentProgressSlice,
} from "@/features/alchemy/shared/stores/run-session-facade";
import type { MetaRouteCtx } from "./route-ctx";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";
import { flattenGearInventories } from "@/lib/gear";
import { useArmoryController } from "@/features/alchemy/meta/screens/armory/use-armory-controller";
import { useShallow } from "zustand/react/shallow";

function MenuScreenRoute({ run }: Pick<MetaRouteCtx, "run">) {
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
      {...(platform.canQuit ? { onQuit: () => platform.quit() } : {})}
      logoSrc={menuLogo}
      logoSrcVariants={menuLogoVariants}
      hasUnspentTalents={hasUnspentTalents}
      hasAffordableHomestead={hasAffordableHomestead}
      isArmoryLocked={isArmoryLocked}
    />
  );
}

function ArmoryScreenRoute({ onOpenBattleMenu }: Pick<MetaRouteCtx, "onOpenBattleMenu">) {
  const controller = useArmoryController();
  return (
    <ArmoryScreen
      inventories={controller.inventories}
      loadouts={controller.loadouts}
      gearBoardPositionsByCharacter={controller.gearBoardPositionsByCharacter}
      currencyBoardPositionsByCharacter={controller.currencyBoardPositionsByCharacter}
      craftingCurrencies={controller.craftingCurrencies}
      onApplyCurrency={controller.onApplyCurrency}
      finishedRunCharacters={controller.finishedRunCharacters}
      browseOnly={controller.browseOnly}
      onOpenMenu={onOpenBattleMenu}
      onEquip={controller.onEquip}
      onUnequip={controller.onUnequip}
      onSalvage={controller.onSalvage}
      onTransferGear={controller.onTransferGear}
      onMoveBoardItem={controller.onMoveBoardItem}
      onSortBoard={controller.onSortBoard}
      {...(controller.onSpawnDevGear ? { onSpawnDevGear: controller.onSpawnDevGear } : {})}
    />
  );
}

function GameModeSelectScreenRoute({ run }: Pick<MetaRouteCtx, "run">) {
  const hasActiveRun = useHasActiveRun();
  const activeContentSystemType = useContentSystemType();
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

function CollectionScreenRoute({ onOpenBattleMenu }: Pick<MetaRouteCtx, "onOpenBattleMenu">) {
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
  const bondedCompanions = useBondedCompanions();

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

function HomesteadScreenRoute({ onOpenBattleMenu }: Pick<MetaRouteCtx, "onOpenBattleMenu">) {
  const homesteadValues = useHomesteadProgressSlice();
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

function TalentsScreenRoute({ run, onOpenBattleMenu }: Pick<MetaRouteCtx, "run" | "onOpenBattleMenu">) {
  const { talentXP, unlockedTalents } = useTalentProgressSlice();

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

export const metaScreenRoutes: {
  menu: (ctx: MetaRouteCtx) => ReactNode;
  "game-mode-select": (ctx: MetaRouteCtx) => ReactNode;
  collection: (ctx: MetaRouteCtx) => ReactNode;
  homestead: (ctx: MetaRouteCtx) => ReactNode;
  talents: (ctx: MetaRouteCtx) => ReactNode;
  armory: (ctx: MetaRouteCtx) => ReactNode;
} = {
  menu: ({ run }) => <MenuScreenRoute run={run} />,
  "game-mode-select": ({ run }) => <GameModeSelectScreenRoute run={run} />,
  collection: ({ onOpenBattleMenu }) => <CollectionScreenRoute onOpenBattleMenu={onOpenBattleMenu} />,
  homestead: ({ onOpenBattleMenu }) => <HomesteadScreenRoute onOpenBattleMenu={onOpenBattleMenu} />,
  talents: ({ run, onOpenBattleMenu }) => <TalentsScreenRoute run={run} onOpenBattleMenu={onOpenBattleMenu} />,
  armory: ({ onOpenBattleMenu }) => <ArmoryScreenRoute onOpenBattleMenu={onOpenBattleMenu} />,
};
