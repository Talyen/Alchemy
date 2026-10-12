import { useEffect, useState, useMemo, useRef } from "react";
import { type BuildingId, type FarmId, type MaterialInventory, type ResearchId } from "@/lib/homestead/types";
import { PageLayout, ScreenHeaderRow, ScreenShell } from "../../shared/ui/layout-components";
import { PaginationControls } from "../../shared/ui/navigation";
import { getPagination } from "../../shared/ui/pagination";
import { FadeSlot } from "../../shared/ui/use-fade";
import { playUISound } from "@/lib/audio";
import { cardLibrary, visitBattleCardEffects, type CompanionId } from "@/lib/game-data";
import { COLLECTION_CARD_REFERENCE_WIDTH } from "../../shared/config";
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
import { HomesteadWallet } from "./homestead/resource-wallet";
import {
  getCompanionId,
  getCompanionNode,
  getUpgradeNode,
  type HomesteadSelection,
  type HomesteadNodeModel,
} from "./homestead/node-model";

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
  const [purchaseState, setPurchaseState] = useState<{ node: HomesteadNodeModel; saved: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const submittedLevels = useRef(new Map<string, number>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const discoveredIds = useMemo(() => new Set(discoveredCardIds), [discoveredCardIds]);

  function getNode(item: HomesteadSelection) {
    if (item.kind === "companion") {
      return getCompanionNode(item.card, discoveredIds.has(item.card.id), bondedCompanions, materialInventory);
    }
    const levels =
      item.kind === "building" ? constructedBuildings : item.kind === "farm" ? plantedFarms : completedResearch;
    return getUpgradeNode(item, (levels as Record<string, number>)[item.data.id] ?? 0, materialInventory);
  }

  function purchase(item: HomesteadSelection, node: HomesteadNodeModel) {
    if (pending.current || node.level <= (submittedLevels.current.get(node.id) ?? -1) || !node.cost || !node.affordable)
      return;
    pending.current = true;
    const accepted =
      item.kind === "companion"
        ? (() => {
            const id = getCompanionId(item.card);
            return id ? onBondCompanion(id) : false;
          })()
        : item.kind === "building"
          ? onConstructBuilding(item.data.id)
          : item.kind === "farm"
            ? onPlantFarm(item.data.id)
            : onCompleteResearch(item.data.id);
    if (!accepted) {
      pending.current = false;
      setError(`Could not ${node.action.toLowerCase()} ${node.title}. Materials were not spent.`);
      return;
    }
    submittedLevels.current.set(node.id, node.level);
    setPurchaseState({ node, saved: false });
    setError(null);
    let acknowledged = false;
    afterProgressSaved(() => {
      if (acknowledged || !mounted.current) return;
      acknowledged = true;
      pending.current = false;
      setPurchaseState({ node, saved: true });
      playUISound(node.companion ? "bond" : "talentUnlock");
    });
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
  const tileWidth = isCompanions ? COLLECTION_CARD_REFERENCE_WIDTH : HOMESTEAD_CONFIG.landscapeNodeWidth;
  const columns = isCompanions ? 4 : 3;
  const rowWidth = columns * tileWidth + (columns - 1) * 20 + 0.5;

  return (
    <PageLayout>
      <ScreenShell maxWidthClass="max-w-[calc(88*var(--content-rem,1rem))]" className="relative">
        <ScreenHeaderRow title="Homestead" onBack={onBack} onMenu={onMenu} />
        <div className="mt-6 flex w-full flex-col">
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
                  onPageChange={(next) => {
                    if (isCompanions) setCompanionPage(next);
                    else setUpgradePage(next);
                  }}
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
                {pageItems.map((item, index) => {
                  const liveNode = getNode(item);
                  const saving = purchaseState !== null && !purchaseState.saved;
                  const isPurchasing = purchaseState?.node.id === liveNode.id;
                  const node = saving && isPurchasing ? purchaseState.node : liveNode;
                  const awaitingProgress = isPurchasing && liveNode.level <= purchaseState.node.level;
                  return (
                    <div
                      key={node.id}
                      className="max-w-full shrink-0"
                      style={{ width: `calc(${tileWidth}px * var(--content-scale, 1))` }}
                    >
                      <HomesteadNodeArtwork
                        node={node}
                        inventory={materialInventory}
                        tooltipPlacement={index < columns ? "below" : "above"}
                        saving={saving && isPurchasing}
                        awaitingProgress={awaitingProgress || (saving && !isPurchasing)}
                        onPurchase={() => purchase(item, liveNode)}
                      />
                    </div>
                  );
                })}
              </div>
            </FadeSlot>
          </CollectionContentLayout>
        </div>
        {error && (
          <p role="alert" className="absolute inset-x-0 top-full mt-2 text-center text-sm text-destructive">
            {error}
          </p>
        )}
      </ScreenShell>
    </PageLayout>
  );
}
