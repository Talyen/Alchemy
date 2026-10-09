import { useState, useMemo } from "react";
import { type BuildingId, type FarmId, type MaterialInventory, type ResearchId } from "@/lib/homestead/types";
import { PageLayout, ScreenHeaderRow, ScreenShell } from "../../shared/ui/layout-components";
import { PaginationControls } from "../../shared/ui/navigation";
import { getPagination } from "../../shared/ui/pagination";
import { FadeSlot } from "../../shared/ui/use-fade";
import { playUISound } from "@/lib/audio";
import { cardLibrary, visitBattleCardEffects, type CompanionId } from "@/lib/game-data";
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

const companionCards = cardLibrary.filter((card) =>
  visitBattleCardEffects(card.effects, (effect) => effect.kind === "summon-companion"),
);

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
  afterProgressSaved = (feedback) => feedback(),
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
  afterProgressSaved?: (feedback: () => void) => void;
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
    if (success) afterProgressSaved(() => playUISound("talentUnlock"));
  }

  const upgradeItems =
    tab === "buildings" ? BUILDING_GOAL_ITEMS : tab === "farm" ? FARM_GOAL_ITEMS : RESEARCH_GOAL_ITEMS;
  const upgradeLevels = tab === "buildings" ? constructedBuildings : tab === "farm" ? plantedFarms : completedResearch;
  const isCompanions = tab === "companions";
  const columns = isCompanions ? 4 : 3;
  const items = isCompanions ? companionCards : upgradeItems;
  const pageSize = isCompanions ? HOMESTEAD_CONFIG.companionPageSize : HOMESTEAD_CONFIG.upgradePageSize;
  const { page, totalPages } = getPagination(items.length, isCompanions ? companionPage : upgradePage, pageSize);
  const pageItems = items.slice(page * pageSize, (page + 1) * pageSize);
  const tileWidth = isCompanions ? COLLECTION_CARD_REFERENCE_WIDTH : COLLECTION_BESTIARY_REFERENCE_WIDTH;
  const rowWidth = columns * tileWidth + (columns - 1) * 20 + 0.5;

  function handleSelectTab(nextTab: Tab) {
    setTab(nextTab);
    setUpgradePage(0);
  }

  function handleBondCompanion(companionId: CompanionId) {
    if (onBondCompanion(companionId)) {
      afterProgressSaved(() => playUISound("bond"));
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
            swapKey={isCompanions ? `companions-${page}` : `${tab}-${page}`}
            className="mx-auto w-full overflow-visible"
          >
            <div
              className="mx-auto flex max-w-full flex-wrap justify-center gap-x-5 gap-y-8"
              style={{ width: `calc(${rowWidth}px * var(--content-scale, 1))` }}
            >
              {pageItems.map((item) => (
                <div
                  key={"kind" in item ? item.data.id : item.id}
                  className="max-w-full shrink-0"
                  style={{ width: `calc(${tileWidth}px * var(--content-scale, 1))` }}
                >
                  {"kind" in item ? (
                    <HomesteadUpgradeNode
                      item={item}
                      currentLevel={(upgradeLevels as Record<string, number>)[item.data.id] ?? 0}
                      materialInventory={materialInventory}
                      onAction={handleAction}
                    />
                  ) : (
                    <CompanionCardNode
                      card={item}
                      discovered={discoveredIds.has(item.id)}
                      bondedCompanions={bondedCompanions}
                      materialInventory={materialInventory}
                      onBond={handleBondCompanion}
                    />
                  )}
                </div>
              ))}
            </div>
          </FadeSlot>

          {totalPages > 1 ? (
            <div className="mx-auto flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
              <PaginationControls
                page={page}
                totalPages={totalPages}
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
