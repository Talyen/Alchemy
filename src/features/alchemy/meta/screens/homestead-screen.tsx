// Homestead screen — persistent progression hub with free-order unlocking.
// All nodes show in a 3-column grid; each uncompleted node can be built if
// materials are sufficient. Completed nodes are dimmed with a checkmark.

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { type BuildingId, type FarmId, type MaterialInventory, type ResearchId } from "@/lib/homestead/types";
import { buildings, visibleFarmPlots, researchUpgrades } from "@/lib/homestead/data";
import {
  HamburgerTrigger,
  PageLayout,
  PaginationControls,
  ScreenHeaderRow,
  ScreenShell,
  StaggerGroup,
} from "../../shared/ui/shared-ui";
import { playUISound } from "@/lib/audio";
import { cardLibrary, type CompanionId } from "@/lib/game-data";
import { HOMESTEAD_CONFIG, type GoalItem, type Tab, MaterialsBar, HomesteadTabs, getItems } from "./homestead/helpers";
import { CompanionCardNode } from "./homestead/companion-node";
import { HomesteadUpgradeNode } from "./homestead/upgrade-node";

const companionCards = cardLibrary.filter((c) => c.effects.some((e) => e.kind === "summon-companion"));

export function HomesteadScreen({
  materialInventory,
  constructedBuildings,
  plantedFarms,
  completedResearch,
  bondedCompanions,
  discoveredCardIds,
  onOpenMenu,
  onConstructBuilding,
  onPlantFarm,
  onCompleteResearch,
  onBondCompanion,
}: {
  materialInventory: MaterialInventory;
  constructedBuildings: Record<BuildingId, number>;
  plantedFarms: Record<FarmId, number>;
  completedResearch: Record<ResearchId, number>;
  bondedCompanions: Record<CompanionId, number>;
  discoveredCardIds: string[];
  onOpenMenu: (rect?: DOMRect) => void;
  onConstructBuilding: (id: BuildingId) => boolean;
  onPlantFarm: (id: FarmId) => boolean;
  onCompleteResearch: (id: ResearchId) => boolean;
  onBondCompanion: (id: CompanionId) => boolean;
}) {
  const [tab, setTab] = useState<Tab>("buildings");
  const [companionPage, setCompanionPage] = useState(0);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  const buildingsItems = useMemo(() => getItems("buildings", buildings), []);
  const farmItems = useMemo(() => getItems("farm", visibleFarmPlots), []);
  const researchItems = useMemo(() => getItems("research", researchUpgrades), []);

  function handleAction(item: GoalItem) {
    const success =
      item.kind === "building"
        ? onConstructBuilding(item.data.id)
        : item.kind === "farm"
          ? onPlantFarm(item.data.id)
          : onCompleteResearch(item.data.id);
    if (success) playUISound("talentUnlock");
  }

  const companionPages = Math.max(1, Math.ceil(companionCards.length / HOMESTEAD_CONFIG.companionPageSize));

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
      <ScreenShell maxWidthClass="max-w-7xl" minHeightClass={HOMESTEAD_CONFIG.shellMinHeightClass} className="relative">
        <ScreenHeaderRow
          title="Homestead"
          trailing={<HamburgerTrigger onClick={onOpenMenu} label="Open homestead menu" />}
        />

        <MaterialsBar materialInventory={materialInventory} />
        <HomesteadTabs activeTab={tab} onSelectTab={setTab} />

        <div className="mx-auto mt-6 grid w-full">
          {(["buildings", "farm", "research", "companions"] as const).map((t) => {
            const isActive = tab === t;
            if (t === "companions") {
              return (
                <div
                  key={t}
                  className={cn(
                    "motion-crossfade col-start-1 row-start-1",
                    isActive ? "opacity-100" : "motion-crossfade-hidden pointer-events-none opacity-0",
                  )}
                >
                  <div className="grid">
                    {Array.from({ length: companionPages }, (_, pageIndex) => {
                      const pageItems = companionCards.slice(
                        pageIndex * HOMESTEAD_CONFIG.companionPageSize,
                        (pageIndex + 1) * HOMESTEAD_CONFIG.companionPageSize,
                      );
                      const isPageActive = companionPage === pageIndex;

                      return (
                        <StaggerGroup
                          key={pageIndex}
                          swapKey={isPageActive ? `companions-${companionPage}` : `companions-page-${pageIndex}`}
                          animate={isPageActive}
                          className={cn(
                            "motion-crossfade col-start-1 row-start-1 grid grid-cols-3 gap-x-1 gap-y-4",
                            isPageActive ? "opacity-100" : "motion-crossfade-hidden pointer-events-none opacity-0",
                          )}
                        >
                          {pageItems.map((card, index) => (
                            <CompanionCardNode
                              key={card.id}
                              card={card}
                              index={index}
                              discovered={discoveredCardIds.includes(card.id)}
                              bondedCompanions={bondedCompanions}
                              materialInventory={materialInventory}
                              hoveredItemId={hoveredItemId}
                              setHoveredItemId={setHoveredItemId}
                              onBond={handleBondCompanion}
                            />
                          ))}
                        </StaggerGroup>
                      );
                    })}
                  </div>
                </div>
              );
            }

            const items = t === "buildings" ? buildingsItems : t === "farm" ? farmItems : researchItems;
            const completedRecord =
              t === "buildings" ? constructedBuildings : t === "farm" ? plantedFarms : completedResearch;

            return (
              <StaggerGroup
                key={t}
                swapKey={`${t}-${isActive ? "active" : "idle"}`}
                animate={isActive}
                className={cn(
                  "motion-crossfade col-start-1 row-start-1",
                  isActive ? "opacity-100" : "motion-crossfade-hidden pointer-events-none opacity-0",
                  "grid grid-cols-3 gap-x-2 gap-y-6",
                )}
              >
                {items.map((item, index) => (
                  <HomesteadUpgradeNode
                    key={item.data.id}
                    item={item}
                    index={index}
                    currentLevel={(completedRecord as Record<string, number>)[item.data.id] ?? 0}
                    materialInventory={materialInventory}
                    hoveredItemId={hoveredItemId}
                    setHoveredItemId={setHoveredItemId}
                    onAction={handleAction}
                  />
                ))}
              </StaggerGroup>
            );
          })}
        </div>

        <div className="mx-auto mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
          {tab === "companions" && (
            <PaginationControls
              page={companionPage}
              totalPages={companionPages}
              onPageChange={setCompanionPage}
              size="sm"
            />
          )}
        </div>
      </ScreenShell>
    </PageLayout>
  );
}
