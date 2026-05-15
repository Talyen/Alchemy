// Homestead screen — persistent progression hub with free-order unlocking.
// All nodes show in a 3-column grid; any uncompleted node can be built if
// materials are sufficient. Completed nodes are dimmed with a checkmark.

import { useState, type ReactNode } from "react";
import { FlaskConical, Hammer, House, Swords, Wheat } from "lucide-react";

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
import { keywordDefinitions } from "@/lib/game-data";

import { clearTiltFromEvent, setTiltFromEvent, tokenizeDescription } from "../utils";


type Tab = "buildings" | "farm" | "research";

type GoalItem =
  | { kind: "building"; data: HomesteadBuilding }
  | { kind: "farm"; data: HomesteadFarm }
  | { kind: "research"; data: HomesteadResearch };

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
  "pasture": pasture,
  "hunters-lodge": huntersLodge,
  "alchemy-lab": alchemyLab,
  "crystal-garden": crystalGarden,
  "wheat-field": wheatField,
  "orchard": orchard,
};

function getArt(id: string): string {
  return itemArt[id] ?? placeholderHomestead;
}

function renderTextWithMaterials(text: string): ReactNode {
  const keywordParts = tokenizeDescription(text);
  const result: ReactNode[] = [];
  for (const part of keywordParts) {
    if (part.keywordId) {
      result.push(<span key={result.length} className={cn(keywordDefinitions[part.keywordId]?.colorClass, "font-semibold")}>{part.text}</span>);
    } else {
      const materialParts = part.text.split(/(Herbs|Food|Wood|Iron|Crystal)/g);
      for (const sub of materialParts) {
        const mat = MATERIAL_IDS.find((m) => materialLabels[m] === sub);
        if (mat) {
          result.push(
            <span key={result.length} className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold align-middle", matPillStyle[mat], matTextColor[mat])}>
              {matIconMap[mat]}{sub}
            </span>
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
];

export function HomesteadScreen({
  materialInventory,
  constructedBuildings,
  plantedFarms,
  completedResearch,
  hasActiveBattle,
  onMainMenu,
  onReturnToBattle,
  onConstructBuilding,
  onPlantFarm,
  onCompleteResearch,
}: {
  materialInventory: MaterialInventory;
  constructedBuildings: BuildingId[];
  plantedFarms: FarmId[];
  completedResearch: ResearchId[];
  hasActiveBattle: boolean;
  onMainMenu: () => void;
  onReturnToBattle: () => void;
  onConstructBuilding: (id: BuildingId) => boolean;
  onPlantFarm: (id: FarmId) => boolean;
  onCompleteResearch: (id: ResearchId) => boolean;
}) {
  const [tab, setTab] = useState<Tab>("buildings");
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  const completed = tab === "buildings" ? constructedBuildings : tab === "farm" ? plantedFarms : completedResearch;
  const allItems = getItems(tab);
  function handleAction(item: GoalItem) {
    const success = item.kind === "building"
      ? onConstructBuilding(item.data.id as BuildingId)
      : item.kind === "farm"
        ? onPlantFarm(item.data.id as FarmId)
        : onCompleteResearch(item.data.id as ResearchId);
    if (success) playUISound("talentUnlock");
  }

  return (
    <PageLayout>
      <div className="alchemy-shell relative flex min-h-[520px] w-full max-w-6xl flex-col rounded-[28px] px-6 py-7 sm:px-8">
        <ScreenHeader title="Homestead" />

        {/* Materials bar */}
        <div className="mx-auto mt-5 flex w-full max-w-2xl flex-nowrap items-center justify-center gap-x-3">
          {MATERIAL_IDS.map((mat) => (
            <span key={mat} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", matPillStyle[mat], matTextColor[mat])}>
              {matIconMap[mat]}
              {materialInventory[mat] ?? 0} {materialLabels[mat]}
            </span>
          ))}
        </div>

        {/* Tabs */}
        <div className="mx-auto mt-5 flex flex-wrap justify-center gap-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                tab === t.id
                  ? "border-primary/70 bg-primary/15 text-foreground"
                  : "border-border/80 bg-card text-foreground hover:bg-secondary/50",
              )}
            >
              {t.id === "buildings" ? <Hammer className="h-4 w-4" /> : t.id === "farm" ? <Wheat className="h-4 w-4" /> : <FlaskConical className="h-4 w-4" />}
              {t.label}
            </button>
          ))}
        </div>

        {/* Grid of all items */}
        <div className="mx-auto mt-6 grid w-full grid-cols-3 gap-x-2 gap-y-6">
          {allItems.map((item, index) => {
              const isCompleted = (completed as string[]).includes(item.data.id);
              const itemCost = item.data.cost;
              const itemAffordable = canAfford(materialInventory, itemCost);
              const costItems = MATERIAL_IDS.filter((m) => (itemCost[m] ?? 0) > 0);

              return (
                <div key={item.data.id} className={cn("flex flex-col items-center", index < 3 && "mb-2")}>
                  {/* Title */}
                  <p className="mb-1.5 w-full truncate text-center text-sm font-semibold text-amber-100/75">
                    {item.data.title}
                  </p>

                  {/* Tilt surface — art only */}
                  <div
                    className="relative"
                    onMouseEnter={() => setHoveredItemId(item.data.id)}
                    onMouseLeave={() => setHoveredItemId(null)}
                  >
                    {hoveredItemId === item.data.id && (() => {
                      const nodes: ReactNode[] = [];
                      const building = item.kind === "building" ? (item.data as HomesteadBuilding) : null;
                      const farm = item.kind === "farm" ? (item.data as HomesteadFarm) : null;
                      const research = item.kind === "research" ? (item.data as HomesteadResearch) : null;

                      // Yield pills for farms
                      if (farm) {
                        for (const m of MATERIAL_IDS) {
                          if ((farm.yield[m] ?? 0) > 0) {
                            nodes.push(
                              <span key={`yield-${m}`} className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", matPillStyle[m], matTextColor[m])}>
                                {matIconMap[m]} +{farm.yield[m]} {materialLabels[m]}
                              </span>
                            );
                          }
                        }
                      }

                      // Benefit descriptions
                      if (building) {
                        for (const line of building.benefitDescription.split("\n")) {
                          nodes.push(<div key={`b-${nodes.length}`} className="text-sm leading-6 text-muted-foreground">{renderTextWithMaterials(line)}</div>);
                        }
                        if (building.nonCombatBenefitDescription) {
                          nodes.push(<div key={`b-${nodes.length}`} className="text-sm leading-6 text-muted-foreground">{renderTextWithMaterials(building.nonCombatBenefitDescription)}</div>);
                        }
                      } else if (farm) {
                        if (farm.benefitDescription) {
                          nodes.push(<div key="combat" className="text-sm leading-6 text-muted-foreground">{renderTextWithMaterials(farm.benefitDescription)}</div>);
                        }
                        if (farm.nonCombatBenefitDescription) {
                          nodes.push(<div key="noncombat" className="text-sm leading-6 text-muted-foreground">{renderTextWithMaterials(farm.nonCombatBenefitDescription)}</div>);
                        }
                      } else if (research) {
                        nodes.push(<div key="benefit" className="text-sm leading-6 text-muted-foreground">{renderTextWithMaterials(research.benefitDescription)}</div>);
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
                    <div
                      className={cn(
                        "group tilt-surface w-full overflow-hidden rounded-[18px] p-3",
                      )}
                      data-tilt-strength="8"
                      onMouseMove={setTiltFromEvent}
                      onMouseLeave={clearTiltFromEvent}
                    >
                      <div className={cn(
                        "relative mx-auto flex aspect-[4/3] w-[90%] items-center justify-center overflow-hidden rounded-[18px] bg-stone-900",
                        isCompleted && "bg-stone-800/70",
                      )}>
                        <img src={getArt(item.data.id)} alt={item.data.title} className="h-full w-full object-cover" />
                      </div>
                    </div>
                  </div>

                  {/* Action button — separate tooltip wrapper */}
                  {!isCompleted && (() => {
                    const hasCost = MATERIAL_IDS.some((m) => (itemCost[m] ?? 0) > 0);
                    return hasCost ? (
                      <div className="mt-1.5">
                        <DisabledTooltip show={!itemAffordable} message="Not Enough Resources">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!itemAffordable}
                            className={itemAffordable ? "border-amber-400/60 shadow-[0_0_10px_rgba(251,191,36,0.35)]" : ""}
                            onClick={() => handleAction(item)}
                          >
                            {item.data.buttonLabel}
                            <span className="ml-1.5 flex items-center gap-1">
                              <MaterialIcon material={costItems[0]} />
                              <span className={matTextColor[costItems[0]]}>{itemCost[costItems[0]]}</span>
                            </span>
                          </Button>
                        </DisabledTooltip>
                      </div>
                    ) : null;
                  })()}
                  {isCompleted && <div className="mt-1.5 h-9" />}
                </div>
              );
            })}
          </div>

        {/* Navigation */}
        <div className="mx-auto mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="outline" onClick={onMainMenu}>
            <House className="h-4 w-4" /> Main Menu
          </Button>
          {hasActiveBattle ? (
            <Button onClick={onReturnToBattle}>
              <Swords className="h-4 w-4" /> Return to Battle
            </Button>
          ) : null}
        </div>
      </div>
    </PageLayout>
  );
}
