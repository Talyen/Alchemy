import type { ReactNode } from "react";
import { isDesktop, quitDesktopApp } from "@/lib/platform";
import { menuLogo } from "@/lib/game-data";
import { useAppScreenChrome } from "@/app/app-screen-chrome-context";
import {
  CollectionScreen,
  GameModeSelectScreen,
  HomesteadScreen,
  MenuScreen,
  TalentsScreen,
  ArmoryScreen,
} from "@/features/alchemy/meta/screens";
import {
  useFinishedRunCharacters,
  useProfileCollectionSlice,
  useProfileDiscoverySlice,
} from "@/features/alchemy/shared/stores/profile-store";
import { useCollectionActions, useHomesteadActions } from "@/features/alchemy/shared/stores/store-actions";
import {
  useBondedCompanions,
  useHomesteadProgressSlice,
  useResumableGameModes,
  useTalentProgressSlice,
} from "@/features/alchemy/shared/stores/run-reads";
import type { MetaCommands, MetaRouteCtx } from "./route-ctx";
import { useIsArmoryLocked } from "@/features/alchemy/shared/stores/gear-store";
import { useArmoryController } from "@/features/alchemy/meta/screens/armory/use-armory-controller";

function MenuScreenRoute({ commands }: { commands: MetaCommands }) {
  const { hasUnspentTalents, hasAffordableHomestead } = useAppScreenChrome();
  const isArmoryLocked = useIsArmoryLocked();
  const finishedRunCharacters = useFinishedRunCharacters();
  return (
    <MenuScreen
      onPlay={() => commands.goToScreen("game-mode-select")}
      onCollection={() => commands.goToScreen("collection")}
      onOptions={() => commands.goToScreen("options")}
      onHomestead={() => commands.goToScreen("homestead")}
      onTalents={() => commands.goToScreen("talents")}
      onArmory={() => commands.goToScreen("armory")}
      {...(isDesktop() ? { onQuit: quitDesktopApp } : {})}
      logoSrc={menuLogo}
      hasUnspentTalents={hasUnspentTalents}
      hasAffordableHomestead={hasAffordableHomestead}
      isArmoryLocked={isArmoryLocked}
      finishedRunCharacters={finishedRunCharacters}
    />
  );
}

function ArmoryScreenRoute({ onOpenBattleMenu }: Pick<MetaRouteCtx, "onOpenBattleMenu">) {
  const controller = useArmoryController();
  return (
    <ArmoryScreen
      inventories={controller.inventories}
      loadouts={controller.loadouts}
      ownedTrinketIds={controller.ownedTrinketIds}
      equippedTrinkets={controller.equippedTrinkets}
      craftingCurrencies={controller.craftingCurrencies}
      onApplyCurrency={controller.onApplyCurrency}
      finishedRunCharacters={controller.finishedRunCharacters}
      browseOnly={controller.browseOnly}
      onOpenMenu={onOpenBattleMenu}
      onEquip={controller.onEquip}
      onUnequip={controller.onUnequip}
      onEquipTrinket={controller.onEquipTrinket}
      onUnequipTrinket={controller.onUnequipTrinket}
      onSalvage={controller.onSalvage}
      rng={controller.rng}
      {...(controller.onSpawnDevGear ? { onSpawnDevGear: controller.onSpawnDevGear } : {})}
    />
  );
}

function GameModeSelectScreenRoute({
  commands,
  onOpenBattleMenu,
}: {
  commands: MetaCommands;
  onOpenBattleMenu: MetaRouteCtx["onOpenBattleMenu"];
}) {
  const resumableModes = useResumableGameModes();
  const finishedRunCharacters = useFinishedRunCharacters();
  return (
    <GameModeSelectScreen
      resumableModes={resumableModes}
      finishedRunCharacters={finishedRunCharacters}
      onSelectCampaign={commands.beginCampaign}
      onSelectLabyrinth={commands.beginLabyrinth}
      onSelectWildwood={commands.beginWildwood}
      onOpenMenu={onOpenBattleMenu}
    />
  );
}

function CollectionScreenRoute({ onOpenBattleMenu }: Pick<MetaRouteCtx, "onOpenBattleMenu">) {
  const profile = useProfileCollectionSlice();
  const collectionActions = useCollectionActions();
  const bondedCompanions = useBondedCompanions();
  const finishedRunCharacters = useFinishedRunCharacters();

  return (
    <CollectionScreen
      onOpenMenu={onOpenBattleMenu}
      collectionTab={profile.collectionTab}
      onSelectTab={collectionActions.handleCollectionTabChange}
      onPageChange={collectionActions.setCollectionPage}
      bondedCompanions={bondedCompanions}
      discoveredCardIds={profile.discoveredCardIds}
      encounteredEnemyIds={profile.encounteredEnemyIds}
      discoveredTrinketIds={profile.discoveredTrinketIds}
      discoveredUniqueIds={profile.discoveredUniqueIds}
      finishedRunCharacters={finishedRunCharacters}
      collectionPages={profile.collectionPages}
    />
  );
}

function HomesteadScreenRoute({ onOpenBattleMenu }: Pick<MetaRouteCtx, "onOpenBattleMenu">) {
  const homesteadValues = useHomesteadProgressSlice();
  const { discoveredCardIds } = useProfileDiscoverySlice();
  const homesteadActions = useHomesteadActions();

  return (
    <HomesteadScreen
      onOpenMenu={onOpenBattleMenu}
      gold={homesteadValues.gold}
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

function TalentsScreenRoute({
  commands,
  onOpenBattleMenu,
}: {
  commands: MetaCommands;
  onOpenBattleMenu: MetaRouteCtx["onOpenBattleMenu"];
}) {
  const { talentXP, unlockedTalents } = useTalentProgressSlice();

  return (
    <TalentsScreen
      talentXP={talentXP}
      unlockedTalents={unlockedTalents}
      onOpenMenu={onOpenBattleMenu}
      onUnlockTalent={commands.unlockTalent}
      onResetTalents={commands.resetUnlockedTalents}
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
  menu: ({ routeCommands }) => <MenuScreenRoute commands={routeCommands.meta} />,
  "game-mode-select": ({ routeCommands, onOpenBattleMenu }) => (
    <GameModeSelectScreenRoute commands={routeCommands.meta} onOpenBattleMenu={onOpenBattleMenu} />
  ),
  collection: ({ onOpenBattleMenu }) => <CollectionScreenRoute onOpenBattleMenu={onOpenBattleMenu} />,
  homestead: ({ onOpenBattleMenu }) => <HomesteadScreenRoute onOpenBattleMenu={onOpenBattleMenu} />,
  talents: ({ routeCommands, onOpenBattleMenu }) => (
    <TalentsScreenRoute commands={routeCommands.meta} onOpenBattleMenu={onOpenBattleMenu} />
  ),
  armory: ({ onOpenBattleMenu }) => <ArmoryScreenRoute onOpenBattleMenu={onOpenBattleMenu} />,
};
