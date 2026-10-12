import { useEffect, useState, useMemo, useRef } from "react";
import { type BuildingId, type FarmId, type MaterialInventory, type ResearchId } from "@/lib/homestead/types";
import { PageLayout, ScreenHeaderRow, ScreenShell } from "../../shared/ui/layout-components";
import { PaginationControls } from "../../shared/ui/navigation";
import { getPagination } from "../../shared/ui/pagination";
import { FadeSlot } from "../../shared/ui/use-fade";
import { useCaptureEscapeCancel } from "../../shared/ui/use-modal-escape-dismiss";
import { cardLibrary, visitBattleCardEffects, type CompanionId } from "@/lib/game-data";
import { COLLECTION_BESTIARY_REFERENCE_WIDTH, COLLECTION_CARD_REFERENCE_WIDTH } from "../../shared/config";
import { CollectionContentLayout } from "./collection/collection-content-layout";
import {
  BUILDING_GOAL_ITEMS,
  FARM_GOAL_ITEMS,
  HOMESTEAD_CONFIG,
  type Tab,
  HomesteadTabs,
  RESEARCH_GOAL_ITEMS,
} from "./homestead/helpers";
import { HomesteadNodeArtwork } from "./homestead/node-artwork";
import { HomesteadNodeDetail } from "./homestead/node-detail";
import { HomesteadWallet } from "./homestead/resource-wallet";
import { getCompanionId, getCompanionNode, getUpgradeNode, type HomesteadSelection } from "./homestead/node-model";

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
  const [selection, setSelection] = useState<HomesteadSelection | null>(null);
  const [lastViewedId, setLastViewedId] = useState<string | null>(null);
  const currentInspection = useRef<HomesteadSelection | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const lastViewedTileRef = useRef<HTMLButtonElement>(null);
  useEffect(
    () => () => {
      currentInspection.current = null;
    },
    [],
  );
  const discoveredIds = useMemo(() => new Set(discoveredCardIds), [discoveredCardIds]);

  function inspect(next: HomesteadSelection) {
    currentInspection.current = next;
    setLastViewedId(next.kind === "companion" ? next.card.id : next.data.id);
    setSelection(next);
  }

  function backToGallery() {
    currentInspection.current = null;
    setSelection(null);
  }
  useCaptureEscapeCancel(selection ? backToGallery : undefined);

  function getNode(item: HomesteadSelection) {
    if (item.kind === "companion") {
      return getCompanionNode(item.card, discoveredIds.has(item.card.id), bondedCompanions, materialInventory);
    }
    const levels =
      item.kind === "building" ? constructedBuildings : item.kind === "farm" ? plantedFarms : completedResearch;
    return getUpgradeNode(item, (levels as Record<string, number>)[item.data.id] ?? 0, materialInventory);
  }

  function purchaseSelected() {
    if (!selection || currentInspection.current !== selection) return false;
    if (selection.kind === "companion") {
      const id = getCompanionId(selection.card);
      return id ? onBondCompanion(id) : false;
    }
    return selection.kind === "building"
      ? onConstructBuilding(selection.data.id)
      : selection.kind === "farm"
        ? onPlantFarm(selection.data.id)
        : onCompleteResearch(selection.data.id);
  }

  const upgradeItems =
    tab === "buildings" ? BUILDING_GOAL_ITEMS : tab === "farm" ? FARM_GOAL_ITEMS : RESEARCH_GOAL_ITEMS;
  const isCompanions = tab === "companions";
  const items: readonly HomesteadSelection[] = isCompanions
    ? companionCards.map((card) => ({ kind: "companion", card }))
    : upgradeItems;
  const pageSize = isCompanions ? HOMESTEAD_CONFIG.companionPageSize : HOMESTEAD_CONFIG.upgradePageSize;
  const { page, totalPages } = getPagination(items.length, isCompanions ? companionPage : upgradePage, pageSize);
  const pageItems = items.slice(page * pageSize, (page + 1) * pageSize);
  const tileWidth = isCompanions ? COLLECTION_CARD_REFERENCE_WIDTH : COLLECTION_BESTIARY_REFERENCE_WIDTH;
  const columns = isCompanions ? 4 : 3;
  const rowWidth = columns * tileWidth + (columns - 1) * 20 + 0.5;
  const selectedNode = selection ? getNode(selection) : null;

  return (
    <PageLayout>
      <ScreenShell maxWidthClass="max-w-7xl" className="relative">
        <ScreenHeaderRow title="Homestead" onBack={selection ? backToGallery : onBack} onMenu={onMenu} />
        <FadeSlot
          swapKey={selectedNode?.id ?? "gallery"}
          className="mt-6 w-full"
          onReady={(key) => {
            if (key === "gallery") lastViewedTileRef.current?.focus({ preventScroll: true });
            else detailRef.current?.focus({ preventScroll: true });
          }}
        >
          {selectedNode ? (
            <HomesteadNodeDetail
              node={selectedNode}
              inventory={materialInventory}
              onPurchase={purchaseSelected}
              afterProgressSaved={afterProgressSaved}
              isCurrent={() => currentInspection.current === selection}
              detailRef={detailRef}
            />
          ) : (
            <div className="flex flex-col">
              <HomesteadWallet gold={gold} inventory={materialInventory} />
              <div className="mt-6">
                <HomesteadTabs
                  activeTab={tab}
                  onSelectTab={(next) => {
                    setTab(next);
                    setUpgradePage(0);
                  }}
                />
              </div>
              <CollectionContentLayout
                pagination={
                  totalPages > 1 ? (
                    <PaginationControls
                      page={page}
                      totalPages={totalPages}
                      onPageChange={isCompanions ? setCompanionPage : setUpgradePage}
                      size="default"
                      className="mt-0"
                    />
                  ) : null
                }
              >
                <FadeSlot swapKey={`${tab}-${page}`} className="mx-auto w-full overflow-visible">
                  <div
                    className="mx-auto flex max-w-full flex-wrap items-start justify-center gap-5"
                    style={{ width: `calc(${rowWidth}px * var(--content-scale, 1))` }}
                  >
                    {pageItems.map((item) => {
                      const node = getNode(item);
                      return (
                        <div
                          key={node.id}
                          className="max-w-full shrink-0"
                          style={{ width: `calc(${tileWidth}px * var(--content-scale, 1))` }}
                        >
                          <HomesteadNodeArtwork
                            node={node}
                            showStatus
                            onInspect={() => inspect(item)}
                            buttonRef={node.id === lastViewedId ? lastViewedTileRef : undefined}
                          />
                        </div>
                      );
                    })}
                  </div>
                </FadeSlot>
              </CollectionContentLayout>
            </div>
          )}
        </FadeSlot>
      </ScreenShell>
    </PageLayout>
  );
}
