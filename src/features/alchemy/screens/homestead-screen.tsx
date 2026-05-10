// Homestead screen — persistent progression hub with free-order unlocking.
// All nodes show in a 3-column grid; any uncompleted node can be built if
// materials are sufficient. Completed nodes are dimmed with a checkmark.

import { useEffect, useState } from "react";
import { Check, FlaskConical, Hammer, House, Sprout, Swords, Wheat } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MATERIAL_IDS,
  type BuildingId,
  type FarmId,
  type HomesteadBuilding,
  type HomesteadEffectManifest,
  type HomesteadFarm,
  type HomesteadResearch,
  type MaterialInventory,
  type ResearchId,
  canAfford,
  emptyInventory,
  materialLabels,
} from "@/lib/homestead/types";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import blacksmithsForge from "@/assets/optimized/blacksmiths-forge.webp";
import chickenCoop from "@/assets/optimized/chicken-coop.webp";
import herbGarden from "@/assets/optimized/herb-garden.webp";
import pasture from "@/assets/optimized/pasture.webp";
import placeholderHomestead from "@/assets/optimized/placeholder-homestead.webp";

import { AnimatedHeight } from "../ui/animated-height";
import { DisabledTooltip, PageLayout, ScreenHeader } from "../ui/shared-ui";
import { MaterialIcon, matColorHex, matTextColor } from "../ui/material-icons";


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

function totalCount(tab: Tab): number {
  return tab === "buildings" ? buildings.length : tab === "farm" ? farmPlots.length : researchUpgrades.length;
}

function getEffectiveCost(cost: MaterialInventory, costReduction: number): MaterialInventory {
  const effective = emptyInventory();
  for (const mat of MATERIAL_IDS) {
    const base = cost[mat] ?? 0;
    effective[mat] = base > 0 ? Math.ceil(base * (1 - costReduction)) : 0;
  }
  return effective;
}

const itemArt: Record<string, string> = {
  "blacksmiths-forge": blacksmithsForge,
  "chicken-coop": chickenCoop,
  "herb-garden": herbGarden,
  "pasture": pasture,
};

function getArt(id: string): string {
  return itemArt[id] ?? placeholderHomestead;
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
  effects,
  pendingFarmYield,
  lastFarmYield,
  hasActiveBattle,
  onMainMenu,
  onReturnToBattle,
  onConstructBuilding,
  onPlantFarm,
  onCompleteResearch,
  onCollectFarmYield,
  onClearFarmYield,
}: {
  materialInventory: MaterialInventory;
  constructedBuildings: BuildingId[];
  plantedFarms: FarmId[];
  completedResearch: ResearchId[];
  effects: HomesteadEffectManifest;
  pendingFarmYield: boolean;
  lastFarmYield: MaterialInventory | null;
  hasActiveBattle: boolean;
  onMainMenu: () => void;
  onReturnToBattle: () => void;
  onConstructBuilding: (id: BuildingId) => boolean;
  onPlantFarm: (id: FarmId) => boolean;
  onCompleteResearch: (id: ResearchId) => boolean;
  onCollectFarmYield: () => MaterialInventory | null;
  onClearFarmYield: () => void;
}) {
  const [tab, setTab] = useState<Tab>("buildings");
  const [showYieldNotification, setShowYieldNotification] = useState(false);

  useEffect(() => {
    if (pendingFarmYield) onCollectFarmYield();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (lastFarmYield) {
      setShowYieldNotification(true);
      const timer = setTimeout(() => {
        setShowYieldNotification(false);
        onClearFarmYield();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [lastFarmYield, onClearFarmYield]);

  const completed = tab === "buildings" ? constructedBuildings : tab === "farm" ? plantedFarms : completedResearch;
  const allItems = getItems(tab);
  const doneCount = completed.length;
  const total = totalCount(tab);

  const costReduction = tab === "buildings" ? effects.buildingCostReduction : 0;
  const yieldMul = tab === "farm" ? 1 + effects.farmYieldMultiplier : 1;

  function handleAction(item: GoalItem) {
    if (item.kind === "building") onConstructBuilding(item.data.id as BuildingId);
    else if (item.kind === "farm") onPlantFarm(item.data.id as FarmId);
    else onCompleteResearch(item.data.id as ResearchId);
  }

  return (
    <PageLayout>
      <div className="alchemy-shell relative flex min-h-[520px] w-full max-w-6xl flex-col rounded-[28px] px-6 py-7 sm:px-8">
        <ScreenHeader title="Homestead" />

        {/* Farm yield notification */}
        {showYieldNotification && lastFarmYield && (
          <div className="absolute left-1/2 top-20 z-10 -translate-x-1/2 rounded-xl border border-emerald-600/40 bg-emerald-950/90 px-5 py-3 text-center text-sm text-emerald-300 shadow-lg backdrop-blur-sm">
            <div className="mb-1 flex items-center justify-center gap-2 font-semibold">
              <Sprout className="h-4 w-4" /> Farm Yield Collected
            </div>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
              {MATERIAL_IDS.filter((mat) => lastFarmYield[mat] > 0).map((mat) => (
                <span key={mat} className="text-xs">+{lastFarmYield[mat]} {materialLabels[mat]}</span>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mx-auto mt-5 flex flex-wrap justify-center gap-3">
          {tabs.map((t) => {
            const tCount = t.id === "buildings" ? constructedBuildings.length : t.id === "farm" ? plantedFarms.length : completedResearch.length;
            const tTotal = totalCount(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  tab === t.id
                    ? "border-primary/70 bg-primary/15 text-primary"
                    : "border-border/80 bg-card text-foreground hover:bg-secondary/50",
                )}
              >
                {t.id === "buildings" ? <Hammer className="h-4 w-4" /> : t.id === "farm" ? <Wheat className="h-4 w-4" /> : <FlaskConical className="h-4 w-4" />}
                {t.label}
                <span className="ml-0.5 text-[11px] opacity-60">{tCount}/{tTotal}</span>
              </button>
            );
          })}
        </div>

        {/* Materials bar */}
        <div className="mx-auto mt-5 flex w-full max-w-2xl flex-nowrap items-center justify-center gap-x-3">
          {MATERIAL_IDS.map((mat) => (
            <span key={mat} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MaterialIcon material={mat} />
              <span className={cn("font-medium", matTextColor[mat])}>{materialInventory[mat] ?? 0}</span>
              <span className={matTextColor[mat]}>{materialLabels[mat]}</span>
            </span>
          ))}
        </div>

        {/* Grid of all items */}
        <AnimatedHeight deps={[tab, completed.join(","), ...MATERIAL_IDS.map((m) => materialInventory[m])]}>
          <div className="mx-auto mt-6 grid w-full grid-cols-3 gap-4">
            {allItems.map((item) => {
              const isCompleted = (completed as string[]).includes(item.data.id);
              const itemCost = getEffectiveCost(item.data.cost, costReduction);
              const itemAffordable = canAfford(materialInventory, itemCost);
              const costItems = MATERIAL_IDS.filter((m) => (itemCost[m] ?? 0) > 0);

              return (
                <div
                  key={item.data.id}
                  className={cn(
                    "relative flex flex-col items-center gap-0",
                    isCompleted && "opacity-55",
                  )}
                >
                  {/* Title + Art frame */}
                  <div className="flex w-full flex-col items-center gap-0">
                    <p className="mb-2 w-full truncate text-center text-sm font-semibold text-foreground">
                      {item.data.title}
                    </p>

                    <div className={cn(
                      "flex aspect-[4/3] w-4/5 items-center justify-center overflow-hidden rounded-[18px] border",
                      isCompleted
                        ? "border-stone-600/70 bg-stone-800/70"
                        : "border-amber-700/60 bg-stone-900",
                    )}>
                      <img src={getArt(item.data.id)} alt={item.data.title} className={cn("h-full w-full object-cover", isCompleted ? "grayscale" : "")} />
                    </div>
                  </div>

                  {/* Persistent material costs */}
                  {!isCompleted && costItems.length > 0 && (
                    <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {costItems.map((mat) => {
                        const need = itemCost[mat];
                        return (
                          <span key={mat} className="flex items-center gap-1">
                            <MaterialIcon material={mat} />
                            <span className={cn("font-medium", matTextColor[mat])}>{need}</span>
                            <span className={matTextColor[mat]}>{materialLabels[mat]}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Action button */}
                  {!isCompleted && (() => {
                    const hasCost = MATERIAL_IDS.some((m) => (itemCost[m] ?? 0) > 0);
                    return hasCost ? (
                      <div className="mt-3">
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
                </div>
              );
            })}
          </div>
        </AnimatedHeight>

        {/* All-completed message */}
        {doneCount === total && total > 0 && (
          <div className="mx-auto mt-6 flex items-center gap-3 rounded-[18px] border border-border/70 p-6 text-center">
            <Check className="h-6 w-6 text-emerald-400 shrink-0" />
            <span className="text-muted-foreground">All {tab} completed!</span>
          </div>
        )}

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
