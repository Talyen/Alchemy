import { useState, useMemo } from "react";
import { type BuildingId, type FarmId, type MaterialInventory, type ResearchId } from "@/lib/homestead/types";
import { PageLayout, ScreenHeaderRow, ScreenShell } from "../../shared/ui/layout-components";
import { PaginationControls } from "../../shared/ui/navigation";
import { getPagination } from "../../shared/ui/pagination";
import { FadeSlot } from "../../shared/ui/use-fade";
import { playUISound } from "@/lib/audio";
import { cardLibrary, type CompanionId } from "@/lib/game-data";
import { COLLECTION_BESTIARY_REFERENCE_WIDTH, COLLECTION_CARD_REFERENCE_WIDTH } from "../../shared/config";
import {
  BUILDING_GOAL_ITEMS,
  FARM_GOAL_ITEMS,
  HOMESTEAD_CONFIG,
  type GoalItem,
  type Tab,
  MaterialsBar,
  HomesteadTabs,
  RESEARCH_GOAL_ITEMS,
} from "./homestead/helpers";
import { CompanionCardNode } from "./homestead/companion-node";
import { HomesteadUpgradeNode } from "./homestead/upgrade-node";

const companionCards = cardLibrary.filter((c) => c.effects.some((e) => e.kind === "summon-companion"));

export function HomesteadScreen({
  gold = 0,
  materialInventory,
  constructedBuildings,
  plantedFarms,
  completedResearch,
  bondedCompanions,
  discoveredCardIds,
  onConstructBuilding,
  onPlantFarm,
  onCompleteResearch,
  onBondCompanion,
  onBack,
  onMenu,
}: {
  gold?: number;
  materialInventory: MaterialInventory;
  constructedBuildings: Record<BuildingId, number>;
  plantedFarms: Record<FarmId, number>;
  completedResearch: Record<ResearchId, number>;
  bondedCompanions: Record<CompanionId, number>;
  discoveredCardIds: string[];
  onConstructBuilding: (id: BuildingId) => boolean;
  onPlantFarm: (id: FarmId) => boolean;
  onCompleteResearch: (id: ResearchId) => boolean;
  onBondCompanion: (id: CompanionId) => boolean;
  onBack?: (() => void) | undefined;
  onMenu?: ((rect: DOMRect) => void) | undefined;
}) {
  const [tab, setTab] = useState<Tab>("buildings");
  const [companionPage, setCompanionPage] = useState(0);
  const [upgradePage, setUpgradePage] = useState(0);

  const discoveredIds = useMemo(() => new Set(discoveredCardIds), [discoveredCardIds]);

  function handleAction(item: GoalItem) {
    const success =
      item.kind === "building"
        ? onConstructBuilding(item.data.id)
        : item.kind === "farm"
          ? onPlantFarm(item.data.id)
          : onCompleteResearch(item.data.id);
    if (success) playUISound("talentUnlock");
  }

  const upgradeItems =
    tab === "buildings" ? BUILDING_GOAL_ITEMS : tab === "farm" ? FARM_GOAL_ITEMS : RESEARCH_GOAL_ITEMS;
  const upgradeLevels = tab === "buildings" ? constructedBuildings : tab === "farm" ? plantedFarms : completedResearch;
  const { page: safeUpgradePage, totalPages: upgradePages } = getPagination(
    upgradeItems.length,
    upgradePage,
    HOMESTEAD_CONFIG.upgradePageSize,
  );
  const visibleUpgradeItems = upgradeItems.slice(
    safeUpgradePage * HOMESTEAD_CONFIG.upgradePageSize,
    (safeUpgradePage + 1) * HOMESTEAD_CONFIG.upgradePageSize,
  );

  const { page: safeCompanionPage, totalPages: companionPages } = getPagination(
    companionCards.length,
    companionPage,
    HOMESTEAD_CONFIG.companionPageSize,
  );
  const visibleCompanionCards = companionCards.slice(
    safeCompanionPage * HOMESTEAD_CONFIG.companionPageSize,
    (safeCompanionPage + 1) * HOMESTEAD_CONFIG.companionPageSize,
  );
  const isCompanions = tab === "companions";
  const columns = isCompanions ? 4 : 3;
  const tileWidth = isCompanions ? COLLECTION_CARD_REFERENCE_WIDTH : COLLECTION_BESTIARY_REFERENCE_WIDTH;
  const rowWidth = columns * tileWidth + (columns - 1) * 20 + 0.5;

  function handleSelectTab(nextTab: Tab) {
    setTab(nextTab);
    setUpgradePage(0);
  }

  function handleBondCompanion(companionId: CompanionId) {
    if (onBondCompanion(companionId)) {
      playUISound("bond");
    }
  }

  return (
    <PageLayout>
      <ScreenShell maxWidthClass="max-w-7xl" className="relative">
        <ScreenHeaderRow title="Homestead" onBack={onBack} onMenu={onMenu} />

        <div className="mt-6 flex flex-col gap-4">
          <MaterialsBar gold={gold} materialInventory={materialInventory} />
          <HomesteadTabs activeTab={tab} onSelectTab={handleSelectTab} />

          <FadeSlot
            swapKey={isCompanions ? `companions-${safeCompanionPage}` : `${tab}-${safeUpgradePage}`}
            className="mx-auto w-full overflow-visible"
          >
            <div
              className="mx-auto flex max-w-full flex-wrap justify-center gap-x-5 gap-y-8"
              style={{ width: `calc(${rowWidth}px * var(--content-scale, 1))` }}
            >
              {isCompanions
                ? visibleCompanionCards.map((card) => (
                    <div
                      key={card.id}
                      className="max-w-full shrink-0"
                      style={{ width: `calc(${tileWidth}px * var(--content-scale, 1))` }}
                    >
                      <CompanionCardNode
                        card={card}
                        discovered={discoveredIds.has(card.id)}
                        bondedCompanions={bondedCompanions}
                        materialInventory={materialInventory}
                        onBond={handleBondCompanion}
                      />
                    </div>
                  ))
                : visibleUpgradeItems.map((item) => (
                    <div
                      key={item.data.id}
                      className="max-w-full shrink-0"
                      style={{ width: `calc(${tileWidth}px * var(--content-scale, 1))` }}
                    >
                      <HomesteadUpgradeNode
                        item={item}
                        currentLevel={(upgradeLevels as Record<string, number>)[item.data.id] ?? 0}
                        materialInventory={materialInventory}
                        onAction={handleAction}
                      />
                    </div>
                  ))}
            </div>
          </FadeSlot>

          {(isCompanions ? companionPages : upgradePages) > 1 ? (
            <div className="mx-auto flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
              <PaginationControls
                page={isCompanions ? safeCompanionPage : safeUpgradePage}
                totalPages={isCompanions ? companionPages : upgradePages}
                onPageChange={isCompanions ? setCompanionPage : setUpgradePage}
                size="default"
                className="mt-0"
              />
            </div>
          ) : null}
        </div>
      </ScreenShell>
    </PageLayout>
  );
}
