// Homestead screen — persistent progression hub with free-order unlocking.
// All nodes show in a 3-column grid; any uncompleted node can be built if
// materials are sufficient. Completed nodes are dimmed with a checkmark.

import { useState, useMemo, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, FlaskConical, Hammer, PawPrint, Wheat } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MATERIAL_IDS,
  type BuildingId,
  type FarmId,
  type HomesteadBuilding,
  type HomesteadFarm,
  type HomesteadResearch,
  type MaterialId,
  type MaterialInventory,
  type ResearchId,
  materialLabels,
} from "@/lib/homestead/types";
import { canAfford } from "@/lib/homestead/inventory";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import blacksmithsForge from "@/assets/optimized/blacksmiths-forge.webp";
import chickenCoop from "@/assets/optimized/chicken-coop.webp";
import herbGarden from "@/assets/optimized/herb-garden.webp";
import pasture from "@/assets/optimized/pasture.webp";
import huntersLodge from "@/assets/optimized/hunters-lodge.webp";
import alchemyLab from "@/assets/optimized/alchemy-lab.webp";
import crystalGarden from "@/assets/optimized/crystal-garden.webp";
import wheatField from "@/assets/optimized/wheat-field.webp";
import orchard from "@/assets/optimized/orchard.webp";
import placeholderHomestead from "@/assets/optimized/placeholder-homestead.webp";

import { DetailPopup } from "../ui/card-ui";
import { DisabledTooltip, HamburgerTrigger, PageLayout, ScreenHeader } from "../ui/shared-ui";
import { MaterialIcon, MaterialPill, matIconMap, matPillStyle, matTextColor } from "../ui/material-icons";
import { StarRating } from "../ui/star-rating";
import { TabBar } from "../ui/tab-bar";
import { TiltSurface } from "../ui/tilt-surface";
import { playUISound } from "@/lib/audio";
import { cardLibrary, keywordDefinitions, type CompanionId } from "@/lib/game-data";
import { COMPANION_BOND_TIERS, COMPANION_MAX_TIER } from "../use-homestead-state";

import { tokenizeDescription } from "../utils";
import { getEffectiveCardDescriptionLines } from "../utils/card-description";

type Tab = "buildings" | "companions" | "farm" | "research";

type GoalItem =
  | { kind: "building"; data: HomesteadBuilding }
  | { kind: "farm"; data: HomesteadFarm }
  | { kind: "research"; data: HomesteadResearch };

// Configuration and layout tokens grouped to avoid magic values
const HOMESTEAD_CONFIG = {
  companionPageSize: 6,
  artAspectRatio: "aspect-[4/3]",
  companionAspectRatio: "aspect-[3/4]",
  companionPageWidth: "w-[65%]",
  compilationFillerCount: 3, // For structural grid layout alignment
} as const;

const companionCards = cardLibrary.filter((c) => c.effects.some((e) => e.kind === "summon-companion"));

const MATERIAL_LABELS_LIST = MATERIAL_IDS.map((m) => materialLabels[m]);
const MATERIAL_REGEX = new RegExp(`(${MATERIAL_LABELS_LIST.join("|")})`, "g");

function getItems(tab: Tab): GoalItem[] {
  const pool = tab === "buildings" ? buildings : tab === "farm" ? farmPlots : researchUpgrades;
  return pool.map((data) => {
    if (tab === "buildings") return { kind: "building" as const, data: data as HomesteadBuilding };
    if (tab === "farm") return { kind: "farm" as const, data: data as HomesteadFarm };
    return { kind: "research" as const, data: data as HomesteadResearch };
  });
}

const itemArt: Record<string, string> = {
  "blacksmiths-forge": blacksmithsForge,
  "chicken-coop": chickenCoop,
  "herb-garden": herbGarden,
  pasture: pasture,
  "hunters-lodge": huntersLodge,
  "alchemy-lab": alchemyLab,
  "crystal-garden": crystalGarden,
  "wheat-field": wheatField,
  orchard: orchard,
};

function getArt(id: string): string {
  return itemArt[id] ?? placeholderHomestead;
}

function MaterialCost({ material, amount }: { material: MaterialId; amount: number }) {
  return (
    <span className="ml-1.5 inline-flex h-5 shrink-0 items-center gap-1 leading-none">
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden">
        <MaterialIcon material={material} />
      </span>
      <span className={cn("tabular-nums leading-none", matTextColor[material])}>{amount}</span>
    </span>
  );
}

function renderTextWithMaterials(text: string): ReactNode {
  const keywordParts = tokenizeDescription(text);
  const result: ReactNode[] = [];
  for (const part of keywordParts) {
    if (part.keywordId) {
      result.push(
        <span key={result.length} className={cn(keywordDefinitions[part.keywordId]?.colorClass, "font-semibold")}>
          {part.text}
        </span>,
      );
    } else {
      const materialParts = part.text.split(MATERIAL_REGEX);
      for (const sub of materialParts) {
        const mat = MATERIAL_IDS.find((m) => materialLabels[m] === sub);
        if (mat) {
          result.push(
            <span
              key={result.length}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold align-middle",
                matPillStyle[mat],
                matTextColor[mat],
              )}
            >
              {matIconMap[mat]}
              {sub}
            </span>,
          );
        } else {
          result.push(<span key={result.length}>{sub}</span>);
        }
      }
    }
  }
  return result;
}

const tabs: { id: Tab; label: string; icon: typeof Hammer }[] = [
  { id: "buildings", label: "Buildings", icon: Hammer },
  { id: "farm", label: "Farm", icon: Wheat },
  { id: "research", label: "Research", icon: FlaskConical },
  { id: "companions", label: "Companions", icon: PawPrint },
];

/** Renders the player's material inventory top-bar */
function MaterialsBar({ materialInventory }: { materialInventory: MaterialInventory }) {
  return (
    <div className="mx-auto mt-5 flex w-full max-w-2xl flex-nowrap items-center justify-center gap-x-3">
      {MATERIAL_IDS.map((mat) => (
        <MaterialPill key={mat} material={mat} amount={materialInventory[mat] ?? 0} />
      ))}
    </div>
  );
}

/** Renders the tab switching header */
function HomesteadTabs({ activeTab, onSelectTab }: { activeTab: Tab; onSelectTab: (tab: Tab) => void }) {
  return <TabBar tabs={tabs} activeTab={activeTab} onSelectTab={onSelectTab} />;
}

/** Individual companion node button layout */
function CompanionCardNode({
  card,
  index,
  discovered,
  bondedCompanions,
  materialInventory,
  hoveredItemId,
  setHoveredItemId,
  onBond,
}: {
  card: (typeof cardLibrary)[number];
  index: number;
  discovered: boolean;
  bondedCompanions: Record<CompanionId, number>;
  materialInventory: MaterialInventory;
  hoveredItemId: string | null;
  setHoveredItemId: (id: string | null) => void;
  onBond: (card: (typeof cardLibrary)[number]) => void;
}) {
  const companionEffect = card.effects.find(
    (e): e is { kind: "summon-companion"; companionId: CompanionId } => e.kind === "summon-companion",
  );
  const companionId = companionEffect?.companionId ?? null;
  const currentLevel = companionId ? (bondedCompanions[companionId] ?? 0) : 0;
  const isComplete = currentLevel >= COMPANION_MAX_TIER;
  const bondCost = COMPANION_BOND_TIERS[Math.min(currentLevel, COMPANION_MAX_TIER - 1)];
  const bondAffordable = discovered && !isComplete && canAfford(materialInventory, bondCost);
  const showButton = discovered && !isComplete;

  return (
    <div className={cn("flex flex-col items-center", index < HOMESTEAD_CONFIG.compilationFillerCount && "mb-2")}>
      <div className="relative">
        {hoveredItemId === card.id && (
          <DetailPopup
            idPrefix={card.id}
            title={discovered ? card.title : "Undiscovered"}
            subtitle={undefined}
            descriptionLines={
              discovered
                ? getEffectiveCardDescriptionLines(card, {
                    companionBondLevels: bondedCompanions,
                  })
                : ["Discover this card during a run to reveal it here."]
            }
          />
        )}
        <div className="group w-full overflow-hidden rounded-[18px] p-3">
          <TiltSurface
            className={cn(
              "relative mx-auto flex items-center justify-center overflow-hidden rounded-[18px] bg-stone-900",
              HOMESTEAD_CONFIG.companionPageWidth,
              HOMESTEAD_CONFIG.companionAspectRatio,
              isComplete && "bg-stone-800/70",
            )}
            onMouseEnter={() => setHoveredItemId(card.id)}
            onMouseLeave={() => setHoveredItemId(null)}
          >
            <img
              src={card.art}
              alt={card.title}
              className={cn("h-full w-full object-cover", !discovered && "grayscale opacity-45")}
            />
          </TiltSurface>
        </div>
      </div>
      {showButton ? (
        <div className="mt-1.5 flex items-center gap-2">
          <DisabledTooltip show={!bondAffordable} message="Not Enough Resources">
            <Button variant="outline" disabled={!bondAffordable} onClick={() => onBond(card)}>
              {card.title}
              <MaterialCost material="food" amount={bondCost.food} />
            </Button>
          </DisabledTooltip>
          <StarRating current={currentLevel} max={COMPANION_MAX_TIER} />
        </div>
      ) : (
        <div className="mt-1.5 flex h-9 items-center justify-center gap-1.5 text-sm font-semibold text-amber-100/75">
          <span>{discovered ? card.title : "Undiscovered"}</span>
          {discovered && <StarRating current={COMPANION_MAX_TIER} max={COMPANION_MAX_TIER} />}
        </div>
      )}
    </div>
  );
}

/** Individual building/farm/research upgrade node layout */
function HomesteadUpgradeNode({
  item,
  index,
  currentLevel,
  materialInventory,
  hoveredItemId,
  setHoveredItemId,
  onAction,
}: {
  item: GoalItem;
  index: number;
  currentLevel: number;
  materialInventory: MaterialInventory;
  hoveredItemId: string | null;
  setHoveredItemId: (id: string | null) => void;
  onAction: (item: GoalItem) => void;
}) {
  const maxTiers = item.data.tiers.length;
  const isTier0 = currentLevel === 0;
  const isCompleted = currentLevel >= maxTiers;
  const displayTierIndex = isCompleted ? maxTiers - 1 : Math.max(0, currentLevel - 1);
  const itemCost = item.data.tiers[isCompleted ? maxTiers - 1 : Math.min(currentLevel, maxTiers - 1)].cost;
  const itemAffordable = !isCompleted && canAfford(materialInventory, itemCost);
  const costItems = MATERIAL_IDS.filter((m) => (itemCost[m] ?? 0) > 0);

  const detailTooltip = useMemo(() => {
    if (hoveredItemId !== item.data.id) return null;
    const nodes: ReactNode[] = [];
    const farm = item.kind === "farm" ? (item.data as HomesteadFarm) : null;
    const currentTier = item.data.tiers[displayTierIndex];

    // Yield pills for farms
    if (farm) {
      for (const m of MATERIAL_IDS) {
        if ((farm.yield[m] ?? 0) > 0) {
          nodes.push(
            <span
              key={`yield-${m}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                matPillStyle[m],
                matTextColor[m],
              )}
            >
              {matIconMap[m]} +{farm.yield[m]} {materialLabels[m]}
            </span>,
          );
        }
      }
    }

    // Benefit descriptions from current/next tier
    if (currentTier) {
      if (currentTier.benefitDescription) {
        for (const line of currentTier.benefitDescription.split("\n")) {
          nodes.push(
            <div key={`b-${nodes.length}`} className="text-sm leading-6 text-muted-foreground">
              {renderTextWithMaterials(line)}
            </div>,
          );
        }
      }
      if (currentTier.nonCombatBenefitDescription) {
        nodes.push(
          <div key={`b-${nodes.length}`} className="text-sm leading-6 text-muted-foreground">
            {renderTextWithMaterials(currentTier.nonCombatBenefitDescription)}
          </div>,
        );
      }
    }

    return (
      <DetailPopup
        idPrefix={item.data.id}
        title={item.data.title}
        subtitle={undefined}
        descriptionLines={item.data.description ? [item.data.description] : []}
        descriptionNodes={nodes}
      />
    );
  }, [hoveredItemId, item, displayTierIndex]);

  const hasCost = MATERIAL_IDS.some((m) => (itemCost[m] ?? 0) > 0);

  return (
    <div className={cn("flex flex-col items-center", index < HOMESTEAD_CONFIG.compilationFillerCount && "mb-2")}>
      {/* Tilt surface — art only */}
      <div
        className="relative"
        onMouseEnter={() => setHoveredItemId(item.data.id)}
        onMouseLeave={() => setHoveredItemId(null)}
      >
        {detailTooltip}
        <div className="group w-full overflow-hidden rounded-[18px] p-3">
          <TiltSurface
            className={cn(
              "relative mx-auto flex w-full items-center justify-center overflow-hidden rounded-[18px] bg-stone-900",
              HOMESTEAD_CONFIG.artAspectRatio,
              isCompleted && "bg-stone-800/70",
            )}
          >
            <img
              src={getArt(item.data.id)}
              alt={item.data.title}
              className={cn("h-full w-full object-cover", isTier0 && "grayscale opacity-60")}
            />
          </TiltSurface>
        </div>
      </div>

      {/* Bottom label / action button */}
      {isCompleted ? (
        <div className="mt-1.5 flex h-9 items-center justify-center gap-1.5 text-sm font-semibold text-amber-100/75">
          <span>{item.data.title}</span>
          <StarRating current={maxTiers} max={maxTiers} />
        </div>
      ) : hasCost ? (
        <div className="mt-1.5 flex items-center gap-2">
          <DisabledTooltip show={!itemAffordable} message="Not Enough Resources">
            <Button variant="outline" disabled={!itemAffordable} onClick={() => onAction(item)}>
              {item.data.title}
              {costItems.map((m) => (
                <MaterialCost key={m} material={m} amount={itemCost[m]} />
              ))}
            </Button>
          </DisabledTooltip>
          <StarRating current={currentLevel} max={maxTiers} />
        </div>
      ) : null}
    </div>
  );
}

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

  const buildingsItems = useMemo(() => getItems("buildings"), []);
  const farmItems = useMemo(() => getItems("farm"), []);
  const researchItems = useMemo(() => getItems("research"), []);

  function handleAction(item: GoalItem) {
    const success =
      item.kind === "building"
        ? onConstructBuilding(item.data.id as BuildingId)
        : item.kind === "farm"
          ? onPlantFarm(item.data.id as FarmId)
          : onCompleteResearch(item.data.id as ResearchId);
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
      <div className="alchemy-shell relative flex min-h-[48.15cqh] w-full max-w-6xl flex-col rounded-[28px] p-7">
        <div className="relative flex w-full items-center justify-center">
          <ScreenHeader title="Homestead" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            <HamburgerTrigger onClick={onOpenMenu} label="Open homestead menu" />
          </div>
        </div>

        <MaterialsBar materialInventory={materialInventory} />
        <HomesteadTabs activeTab={tab} onSelectTab={setTab} />

        {/* Grid — all tabs pre-rendered, only active one visible in flow */}
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
                        <div
                          key={pageIndex}
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
                        </div>
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
              <div
                key={t}
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
              </div>
            );
          })}
        </div>

        {/* Navigation + pagination */}
        <div className="mx-auto mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
          {tab === "companions" && companionPages > 1 && (
            <Button
              aria-label="Previous page"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={companionPage === 0}
              onClick={() => setCompanionPage(companionPage - 1)}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          {tab === "companions" && companionPages > 1 && (
            <Button
              aria-label="Next page"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={companionPage >= companionPages - 1}
              onClick={() => setCompanionPage(companionPage + 1)}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
