import { useState, useMemo } from "react";
import { type BuildingId, type FarmId, type MaterialInventory, type ResearchId } from "@/lib/homestead/types";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import {
  HamburgerTrigger,
  PageLayout,
  PaginationControls,
  ScreenHeaderRow,
  ScreenShell,
} from "../../shared/ui/shared-ui";
import { FadeSlot } from "../../shared/ui/fade-slot";
import { playUISound } from "@/lib/audio";
import { cardLibrary, type CompanionId } from "@/lib/game-data";
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
  onOpenMenu,
  onConstructBuilding,
  onPlantFarm,
  onCompleteResearch,
  onBondCompanion,
}: {
  gold?: number;
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
  const farmItems = useMemo(() => getItems("farm", farmPlots), []);
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
      <ScreenShell
        maxWidthClass="max-w-7xl"
        minHeightClass="min-h-0"
        className="alchemy-shell relative rounded-shell-screen"
      >
        <ScreenHeaderRow
          title="Homestead"
          trailing={<HamburgerTrigger onClick={onOpenMenu} label="Open homestead menu" />}
        />

        <div className="mt-5 flex flex-col gap-4">
          <MaterialsBar gold={gold} materialInventory={materialInventory} />
          <HomesteadTabs activeTab={tab} onSelectTab={setTab} />

          <FadeSlot swapKey={tab === "companions" ? `companions-${companionPage}` : tab} className="mx-auto w-full">
            {tab === "companions" ? (
              <div className="grid grid-cols-4 gap-x-4 gap-y-4">
                {companionCards
                  .slice(
                    companionPage * HOMESTEAD_CONFIG.companionPageSize,
                    (companionPage + 1) * HOMESTEAD_CONFIG.companionPageSize,
                  )
                  .map((card) => (
                    <CompanionCardNode
                      key={card.id}
                      card={card}
                      discovered={discoveredCardIds.includes(card.id)}
                      bondedCompanions={bondedCompanions}
                      materialInventory={materialInventory}
                      hoveredItemId={hoveredItemId}
                      setHoveredItemId={setHoveredItemId}
                      onBond={handleBondCompanion}
                    />
                  ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-x-4 gap-y-4">
                {(tab === "buildings" ? buildingsItems : tab === "farm" ? farmItems : researchItems).map((item) => (
                  <HomesteadUpgradeNode
                    key={item.data.id}
                    item={item}
                    currentLevel={
                      (
                        (tab === "buildings"
                          ? constructedBuildings
                          : tab === "farm"
                            ? plantedFarms
                            : completedResearch) as Record<string, number>
                      )[item.data.id] ?? 0
                    }
                    materialInventory={materialInventory}
                    hoveredItemId={hoveredItemId}
                    setHoveredItemId={setHoveredItemId}
                    onAction={handleAction}
                  />
                ))}
              </div>
            )}
          </FadeSlot>

          <div className="mx-auto flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
            <PaginationControls
              page={companionPage}
              totalPages={tab === "companions" ? companionPages : 1}
              onPageChange={setCompanionPage}
              size="sm"
              reserveSpace
              className="mt-0"
            />
          </div>
        </div>
      </ScreenShell>
    </PageLayout>
  );
}
