// Homestead screen — persistent progression hub with free-order unlocking.
// All nodes show in a 3-column grid; any uncompleted node can be built if
// materials are sufficient. Completed nodes are dimmed with a checkmark.

import { useState, useMemo, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, FlaskConical, Hammer, House, PawPrint, Star, Swords, Wheat } from "lucide-react";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MATERIAL_IDS,
  type BuildingId,
  type FarmId,
  type HomesteadBuilding,
  type HomesteadFarm,
  type HomesteadResearch,
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
import { DisabledTooltip, PageLayout, ScreenHeader } from "../ui/shared-ui";
import { MaterialIcon, matIconMap, matPillStyle, matTextColor } from "../ui/material-icons";
import { playUISound } from "@/lib/audio";
import { cardLibrary, keywordDefinitions, type CompanionId } from "@/lib/game-data";
import { COMPANION_BOND_TIERS, COMPANION_MAX_TIER } from "../use-homestead-state";
import { useBattleStore } from "../stores/battle-store";

import { clearTiltFromEvent, setTiltFromEvent, tokenizeDescription } from "../utils";
import { getEffectiveCardDescriptionLines } from "../utils/card-description";

type Tab = "buildings" | "companions" | "farm" | "research";

type GoalItem =
  | { kind: "building"; data: HomesteadBuilding }
  | { kind: "farm"; data: HomesteadFarm }
  | { kind: "research"; data: HomesteadResearch };

const companionCards = cardLibrary.filter((c) => c.effects.some((e) => e.kind === "summon-companion"));

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
      const materialParts = part.text.split(/(Herbs|Food|Wood|Iron|Crystal)/g);
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

const tabs: { id: Tab; label: string }[] = [
  { id: "buildings", label: "Buildings" },
  { id: "farm", label: "Farm" },
  { id: "research", label: "Research" },
  { id: "companions", label: "Companions" },
];

export function HomesteadScreen({
  materialInventory,
  constructedBuildings,
  plantedFarms,
  completedResearch,
  bondedCompanions,
  discoveredCardIds,
  onMainMenu,
  onReturnToBattle,
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
  onMainMenu: () => void;
  onReturnToBattle: () => void;
  onConstructBuilding: (id: BuildingId) => boolean;
  onPlantFarm: (id: FarmId) => boolean;
  onCompleteResearch: (id: ResearchId) => boolean;
  onBondCompanion: (id: CompanionId) => boolean;
}) {
  const hasActiveBattle = useBattleStore((s) => s.hasActiveBattle);
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

  const COMPANION_PAGE_SIZE = 6;
  const companionPages = Math.max(1, Math.ceil(companionCards.length / COMPANION_PAGE_SIZE));

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
      <div className="alchemy-shell relative flex min-h-[520px] w-full max-w-6xl flex-col rounded-[28px] px-6 py-7 sm:px-8">
        <ScreenHeader title="Homestead" />

        {/* Materials bar */}
        <div className="mx-auto mt-5 flex w-full max-w-2xl flex-nowrap items-center justify-center gap-x-3">
          {MATERIAL_IDS.map((mat) => (
            <span
              key={mat}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                matPillStyle[mat],
                matTextColor[mat],
              )}
            >
              {matIconMap[mat]}
              {materialInventory[mat] ?? 0} {materialLabels[mat]}
            </span>
          ))}
        </div>

        {/* Tabs */}
        <div className="mx-auto mt-5 flex flex-wrap justify-center gap-3">
          {tabs.map((t) => (
            <motion.span
              key={t.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
              <button
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-semibold text-foreground ring-1 ring-offset-1 ring-offset-card transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  tab === t.id
                    ? "ring-primary/70"
                    : "ring-border/30 hover:ring-border/50",
                )}
              >
                {t.id === "buildings" ? (
                  <Hammer className="h-4 w-4" />
                ) : t.id === "farm" ? (
                  <Wheat className="h-4 w-4" />
                ) : t.id === "research" ? (
                  <FlaskConical className="h-4 w-4" />
                ) : (
                  <PawPrint className="h-4 w-4" />
                )}
                {t.label}
              </button>
            </motion.span>
          ))}
        </div>

        {/* Grid — all tabs pre-rendered, only active one visible in flow */}
        <div className="mx-auto mt-6 grid w-full">
          {(["buildings", "farm", "research", "companions"] as const).map((t) => {
            const isActive = tab === t;
            if (t === "companions") {
              return (
                <div
                  key={t}
                  className={cn(
                    "col-start-1 row-start-1 transition-opacity duration-200",
                    isActive ? "opacity-100" : "pointer-events-none opacity-0",
                  )}
                >
                  <div className="grid">
                    {Array.from({ length: companionPages }, (_, pageIndex) => {
                      const pageItems = companionCards.slice(
                        pageIndex * COMPANION_PAGE_SIZE,
                        (pageIndex + 1) * COMPANION_PAGE_SIZE,
                      );
                      return (
                        <div
                          key={pageIndex}
                          className={cn(
                            "col-start-1 row-start-1 grid grid-cols-3 gap-x-1 gap-y-4 transition-opacity duration-200",
                            companionPage === pageIndex ? "opacity-100" : "pointer-events-none opacity-0",
                          )}
                        >
                          {pageItems.map((card, index) => {
                            const companionEffect = card.effects.find(
                              (e): e is { kind: "summon-companion"; companionId: CompanionId } =>
                                e.kind === "summon-companion",
                            );
                            const companionId = companionEffect?.companionId ?? null;
                            const discovered = discoveredCardIds.includes(card.id);
                            const currentLevel = companionId ? (bondedCompanions[companionId] ?? 0) : 0;
                            const isComplete = currentLevel >= COMPANION_MAX_TIER;
                            const bondCost = COMPANION_BOND_TIERS[Math.min(currentLevel, COMPANION_MAX_TIER - 1)];
                            const bondAffordable = discovered && !isComplete && canAfford(materialInventory, bondCost);
                            const showButton = discovered && !isComplete;

                            return (
                              <div key={card.id} className={cn("flex flex-col items-center", index < 3 && "mb-2")}>
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
                                  <div className={cn("group tilt-surface w-full overflow-hidden rounded-[18px] p-3")}>
                                    <div
                                      className={cn(
                                        "relative mx-auto flex aspect-[3/4] w-[65%] items-center justify-center overflow-hidden rounded-[18px] bg-stone-900",
                                        isComplete && "bg-stone-800/70",
                                      )}
                                      onMouseEnter={() => setHoveredItemId(card.id)}
                                      onMouseLeave={() => setHoveredItemId(null)}
                                      onMouseMove={setTiltFromEvent}
                                    >
                                      <img
                                        src={card.art}
                                        alt={card.title}
                                        className={cn("h-full w-full object-cover", !discovered && "grayscale opacity-45")}
                                      />
                                    </div>
                                  </div>
                                </div>
                                {showButton ? (
                                  <div className="mt-1.5 flex items-center gap-2">
                                    <DisabledTooltip show={!bondAffordable} message="Not Enough Resources">
                                      <Button
                                        variant="outline"
                                        disabled={!bondAffordable}
                                        onClick={() => handleBondCompanion(card)}
                                      >
                                        {card.title}
                                        <span className="ml-1.5 flex items-center gap-1">
                                          <MaterialIcon material="food" />
                                          <span className={matTextColor.food}>{bondCost.food}</span>
                                        </span>
                                      </Button>
                                    </DisabledTooltip>
                                    <span className="flex items-center gap-0.5">
                                      {Array.from({ length: COMPANION_MAX_TIER }, (_, i) => (
                                        <Star
                                          key={i}
                                          className={cn(
                                            "h-3 w-3",
                                            i < currentLevel ? "text-amber-400" : "text-muted-foreground",
                                          )}
                                          fill={i < currentLevel ? "currentColor" : "none"}
                                        />
                                      ))}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="mt-1.5 flex h-9 items-center justify-center gap-1.5 text-sm font-semibold text-amber-100/75">
                                    <span>{discovered ? card.title : "Undiscovered"}</span>
                                    {discovered && (
                                      <span className="flex items-center gap-0.5 text-amber-400">
                                        {Array.from({ length: COMPANION_MAX_TIER }, (_, i) => (
                                          <Star key={i} className="h-3 w-3" fill="currentColor" />
                                        ))}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
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
                  "col-start-1 row-start-1 transition-opacity duration-200",
                  isActive ? "opacity-100" : "pointer-events-none opacity-0",
                  "grid grid-cols-3 gap-x-2 gap-y-6",
                )}
              >
                {items.map((item, index) => {
                  const currentLevel = (completedRecord as Record<string, number>)[item.data.id] ?? 0;
                  const maxTiers = item.data.tiers.length;
                  const isTier0 = currentLevel === 0;
                  const isCompleted = currentLevel >= maxTiers;
                  const displayTierIndex = isCompleted ? maxTiers - 1 : Math.max(0, currentLevel - 1);
                  const itemCost =
                    item.data.tiers[isCompleted ? maxTiers - 1 : Math.min(currentLevel, maxTiers - 1)].cost;
                  const itemAffordable = !isCompleted && canAfford(materialInventory, itemCost);
                  const costItems = MATERIAL_IDS.filter((m) => (itemCost[m] ?? 0) > 0);

                  return (
                    <div key={item.data.id} className={cn("flex flex-col items-center", index < 3 && "mb-2")}>
                      {/* Tilt surface — art only */}
                      <div
                        className="relative"
                        onMouseEnter={() => setHoveredItemId(item.data.id)}
                        onMouseLeave={() => setHoveredItemId(null)}
                      >
                        {hoveredItemId === item.data.id &&
                          (() => {
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
                          })()}
                        <div className={cn("group tilt-surface w-full overflow-hidden rounded-[18px] p-3")}>
                          <div
                            className={cn(
                              "relative mx-auto flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-[18px] bg-stone-900",
                              isCompleted && "bg-stone-800/70",
                            )}
                            onMouseMove={setTiltFromEvent}
                            onMouseLeave={clearTiltFromEvent}
                          >
                            <img
                              src={getArt(item.data.id)}
                              alt={item.data.title}
                              className={cn("h-full w-full object-cover", isTier0 && "grayscale opacity-60")}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Bottom label / action button */}
                      {isCompleted ? (
                        <div className="mt-1.5 flex h-9 items-center justify-center gap-1.5 text-sm font-semibold text-amber-100/75">
                          <span>{item.data.title}</span>
                          <span className="flex items-center gap-0.5 text-amber-400">
                            {Array.from({ length: maxTiers }, (_, i) => (
                              <Star key={i} className="h-3 w-3" fill="currentColor" />
                            ))}
                          </span>
                        </div>
                      ) : (
                        (() => {
                          const hasCost = MATERIAL_IDS.some((m) => (itemCost[m] ?? 0) > 0);
                          return hasCost ? (
                            <div className="mt-1.5 flex items-center gap-2">
                              <DisabledTooltip show={!itemAffordable} message="Not Enough Resources">
                                <Button variant="outline" disabled={!itemAffordable} onClick={() => handleAction(item)}>
                                  {item.data.title}
                                  {costItems.map((m) => (
                                    <span key={m} className="ml-1.5 flex items-center gap-1">
                                      <MaterialIcon material={m} />
                                      <span className={matTextColor[m]}>{itemCost[m]}</span>
                                    </span>
                                  ))}
                                </Button>
                              </DisabledTooltip>
                              <span className="flex items-center gap-0.5">
                                {Array.from({ length: maxTiers }, (_, i) => (
                                  <Star
                                    key={i}
                                    className={cn(
                                      "h-3 w-3",
                                      i < currentLevel ? "text-amber-400" : "text-muted-foreground",
                                    )}
                                    fill={i < currentLevel ? "currentColor" : "none"}
                                  />
                                ))}
                              </span>
                            </div>
                          ) : null;
                        })()
                      )}
                    </div>
                  );
                })}
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
          <Button variant="outline" onClick={onMainMenu}>
            <House className="h-4 w-4" /> Main Menu
          </Button>
          {hasActiveBattle ? (
            <Button onClick={onReturnToBattle}>
              <Swords className="h-4 w-4" /> Return to Battle
            </Button>
          ) : null}
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
