import { useState, useMemo } from "react";
import { type BuildingId, type FarmId, type MaterialInventory, type ResearchId } from "@/lib/homestead/types";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { PageLayout, PaginationControls, ScreenHeaderRow, ScreenShell } from "../../shared/ui/shared-ui";
import { FadeSlot } from "../../shared/ui/use-fade";
import { playUISound } from "@/lib/audio";
import { cardLibrary, type CompanionId } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { artTileGridRowsClass, collectionGridGapXClass, collectionGridMinHeightClass } from "../../shared/config";
import { HOMESTEAD_CONFIG, type GoalItem, type Tab, MaterialsBar, HomesteadTabs, getItems } from "./homestead/helpers";
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

  const buildingsItems = useMemo(() => getItems("buildings", buildings), []);
  const farmItems = useMemo(() => getItems("farm", farmPlots), []);
  const researchItems = useMemo(() => getItems("research", researchUpgrades), []);
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

  const upgradeItems = tab === "buildings" ? buildingsItems : tab === "farm" ? farmItems : researchItems;
  const upgradeLevels = tab === "buildings" ? constructedBuildings : tab === "farm" ? plantedFarms : completedResearch;
  const upgradePages = Math.max(1, Math.ceil(upgradeItems.length / HOMESTEAD_CONFIG.upgradePageSize));
  const safeUpgradePage = Math.min(upgradePage, upgradePages - 1);
  const visibleUpgradeItems = upgradeItems.slice(
    safeUpgradePage * HOMESTEAD_CONFIG.upgradePageSize,
    (safeUpgradePage + 1) * HOMESTEAD_CONFIG.upgradePageSize,
  );

  const companionPages = Math.max(1, Math.ceil(companionCards.length / HOMESTEAD_CONFIG.companionPageSize));
  const safeCompanionPage = Math.min(companionPage, companionPages - 1);
  const isCompanions = tab === "companions";

  function handleSelectTab(nextTab: Tab) {
    setTab(nextTab);
    setUpgradePage(0);
  }

  function handleBondCompanion(card: (typeof cardLibrary)[number]) {
    const effect = card.effects.find(
      (e): e is { kind: "summon-companion"; companionId: CompanionId } => e.kind === "summon-companion",
    );
    if (effect && onBondCompanion(effect.companionId)) {
      playUISound("talentUnlock");
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
            className={cn("mx-auto flex w-full flex-col justify-center overflow-visible", collectionGridMinHeightClass)}
          >
            {isCompanions ? (
              <div className={cn("grid w-full grid-cols-4", collectionGridGapXClass, artTileGridRowsClass)}>
                {companionCards
                  .slice(
                    safeCompanionPage * HOMESTEAD_CONFIG.companionPageSize,
                    (safeCompanionPage + 1) * HOMESTEAD_CONFIG.companionPageSize,
                  )
                  .map((card) => (
                    <CompanionCardNode
                      key={card.id}
                      card={card}
                      discovered={discoveredIds.has(card.id)}
                      bondedCompanions={bondedCompanions}
                      materialInventory={materialInventory}
                      onBond={handleBondCompanion}
                    />
                  ))}
              </div>
            ) : (
              <div className={cn("grid w-full grid-cols-3", collectionGridGapXClass, artTileGridRowsClass)}>
                {visibleUpgradeItems.map((item) => (
                  <HomesteadUpgradeNode
                    key={item.data.id}
                    item={item}
                    currentLevel={(upgradeLevels as Record<string, number>)[item.data.id] ?? 0}
                    materialInventory={materialInventory}
                    onAction={handleAction}
                  />
                ))}
              </div>
            )}
          </FadeSlot>

          <div className="mx-auto flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
            <PaginationControls
              page={isCompanions ? safeCompanionPage : safeUpgradePage}
              totalPages={isCompanions ? companionPages : upgradePages}
              onPageChange={isCompanions ? setCompanionPage : setUpgradePage}
              size="default"
              reserveSpace
              className="mt-0"
            />
          </div>
        </div>
      </ScreenShell>
    </PageLayout>
  );
}
