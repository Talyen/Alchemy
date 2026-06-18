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
import { generateDevRandomGearInstance } from "@/lib/gear";
import { flushAlchemySaveNow } from "@/features/alchemy/shared/storage/flush-save";
import {
  resolveActiveRunForSave,
  syncRunMaxHealthFromGear,
  syncRunMaxHealthFromGearMutation,
} from "@/features/alchemy/shared/stores/run-transitions";
import { isAlchemyDevBuild } from "@/features/alchemy/shared/utils/dev-mode";
import type { CharacterId } from "@/lib/game-data";
import type { GearInstance, GearSlot, InventoryPlacement } from "@/lib/gear";

function MenuScreenRoute({ actions: a }: Pick<ScreenRouteContext, "actions">) {
  const { hasUnspentTalents, hasAffordableHomestead } = useAppScreenChrome();
  const isArmoryLocked = useGearStore((s) => s.inventory.length === 0);
  return (
    <MenuScreen
      onPlay={() => a.navigation.goToScreen("game-mode-select")}
      onCollection={() => a.navigation.goToScreen("collection")}
      onOptions={() => a.navigation.goToOptions()}
      onHomestead={() => a.navigation.goToScreen("homestead")}
      onTalents={() => a.navigation.goToScreen("talents")}
      onArmory={() => a.navigation.goToScreen("armory")}
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
  const { returnToRunScreen } = useAppScreenChrome();
  const gear = useGearStore(
    useShallow((s) => ({
      inventory: s.inventory,
      loadouts: s.loadouts,
      equip: s.equip,
      unequip: s.unequip,
      salvage: s.salvage,
      addInstance: s.addInstance,
      craftingCurrencies: s.craftingCurrencies,
      applyCurrency: s.applyCurrency,
    })),
  );
  const finishedRunCharacters = useAppStore((s) => s.finishedRunCharacters);
  const hasActiveBattle = useRunDomainStore((s) => s.battle.hasActiveBattle);
  const hasActiveRun = useRunDomainStore((s) => s.session.hasActiveRun);
  const activeRunCharacterId = useRunDomainStore((s) => s.progress.characterId);

  function syncGearMaxHealthIfActiveRun(characterId: CharacterId, loadoutsBefore: typeof gear.loadouts) {
    if (!hasActiveRun || hasActiveBattle || characterId !== activeRunCharacterId) return;
    syncRunMaxHealthFromGear(characterId, gear.inventory, loadoutsBefore, useGearStore.getState().loadouts);
  }

  function syncGearMutationMaxHealthIfActiveRun(inventoryBefore: GearInstance[], loadoutsBefore: typeof gear.loadouts) {
    if (!hasActiveRun || hasActiveBattle) return;
    const gearAfter = useGearStore.getState();
    syncRunMaxHealthFromGearMutation(
      activeRunCharacterId,
      inventoryBefore,
      loadoutsBefore,
      gearAfter.inventory,
      gearAfter.loadouts,
    );
  }

  function handleEquip(
    characterId: CharacterId,
    slot: GearSlot,
    instance: GearInstance,
    options?: { vacatedPlacement?: InventoryPlacement; swapDisplaced?: boolean },
  ) {
    const loadoutsBefore = gear.loadouts;
    gear.equip(characterId, slot, instance, options);
    syncGearMaxHealthIfActiveRun(characterId, loadoutsBefore);
  }

  function handleUnequip(characterId: CharacterId, slot: GearSlot) {
    const loadoutsBefore = gear.loadouts;
    gear.unequip(characterId, slot);
    syncGearMaxHealthIfActiveRun(characterId, loadoutsBefore);
  }

  return (
    <ArmoryScreen
      inventory={gear.inventory}
      loadouts={gear.loadouts}
      craftingCurrencies={gear.craftingCurrencies}
      onApplyCurrency={(currencyId, instanceId) => {
        if (hasActiveBattle) return false;
        const inventoryBefore = gear.inventory;
        const loadoutsBefore = gear.loadouts;
        const ok = gear.applyCurrency(currencyId, instanceId);
        if (ok) {
          syncGearMutationMaxHealthIfActiveRun(inventoryBefore, loadoutsBefore);
          void flushAlchemySaveNow(resolveActiveRunForSave(hasActiveRun, returnToRunScreen ?? undefined));
        }
        return ok;
      }}
      finishedRunCharacters={finishedRunCharacters}
      browseOnly={hasActiveBattle}
      onOpenMenu={onOpenBattleMenu}
      onEquip={handleEquip}
      onUnequip={handleUnequip}
      onSalvage={(instanceId) => {
        if (hasActiveBattle) return;
        const inventoryBefore = gear.inventory;
        const loadoutsBefore = gear.loadouts;
        const result = gear.salvage(instanceId);
        if (!result) return;
        syncGearMutationMaxHealthIfActiveRun(inventoryBefore, loadoutsBefore);
        void flushAlchemySaveNow(resolveActiveRunForSave(hasActiveRun, returnToRunScreen ?? undefined));
      }}
      {...(isAlchemyDevBuild()
        ? {
            onSpawnDevGear: () => {
              if (!isAlchemyDevBuild()) return;
              gear.addInstance(generateDevRandomGearInstance());
              void flushAlchemySaveNow(resolveActiveRunForSave(hasActiveRun, returnToRunScreen ?? undefined));
            },
          }
        : {})}
    />
  );
}

function GameModeSelectScreenRoute({ actions: a }: Pick<ScreenRouteContext, "actions">) {
  const hasActiveRun = useRunDomainStore((s) => s.session.hasActiveRun);
  const activeContentSystemType = useRunDomainStore((s) => s.progress.contentSystemType);
  return (
    <GameModeSelectScreen
      hasActiveRun={hasActiveRun}
      activeContentSystemType={activeContentSystemType}
      onSelectCampaign={a.runStart.beginCampaign}
      onSelectLabyrinth={a.runStart.beginLabyrinth}
      onSelectWildwood={a.runStart.beginWildwood}
      onBack={() => a.navigation.goToScreen("menu")}
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

function TalentsScreenRoute({
  actions: a,
  onOpenBattleMenu,
}: Pick<ScreenRouteContext, "actions" | "onOpenBattleMenu">) {
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
      onUnlockTalent={a.meta.unlockTalent}
      onResetTalents={a.meta.resetUnlockedTalents}
    />
  );
}

export const metaScreenRoutes: Partial<Record<import("@/lib/routing").Screen, (ctx: ScreenRouteContext) => ReactNode>> =
  {
    menu: ({ actions: a }) => <MenuScreenRoute actions={a} />,
    "game-mode-select": ({ actions: a }) => <GameModeSelectScreenRoute actions={a} />,
    collection: ({ onOpenBattleMenu }) => <CollectionScreenRoute onOpenBattleMenu={onOpenBattleMenu} />,
    homestead: ({ onOpenBattleMenu }) => <HomesteadScreenRoute onOpenBattleMenu={onOpenBattleMenu} />,
    talents: ({ actions: a, onOpenBattleMenu }) => (
      <TalentsScreenRoute actions={a} onOpenBattleMenu={onOpenBattleMenu} />
    ),
    armory: ({ onOpenBattleMenu }) => <ArmoryScreenRoute onOpenBattleMenu={onOpenBattleMenu} />,
  };
