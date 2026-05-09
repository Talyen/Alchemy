// Homestead screen — persistent progression hub with free-order unlocking.
// All nodes show in a 3-column grid; any uncompleted node can be built if
// materials are sufficient. Completed nodes are dimmed with a checkmark.

import { useEffect, useState } from "react";
import { Apple, Check, FlaskConical, Gem, Hammer, House, Leaf, Mountain, PawPrint, Pickaxe, Sprout, Swords, TreePine, Wheat } from "lucide-react";

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
import herbGarden from "@/assets/optimized/herb-garden.webp";

import { AnimatedHeight } from "../ui/animated-height";
import { PageLayout, ScreenHeader } from "../ui/shared-ui";

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

function getBenefitText(item: GoalItem, yieldMul: number): string {
  if (item.kind === "building") return item.data.description + "\n" + item.data.benefitDescription;
  if (item.kind === "farm") {
    const f = item.data;
    const yieldStr = MATERIAL_IDS.filter((m) => f.yield[m] > 0)
      .map((m) => { const actual = Math.floor(f.yield[m] * yieldMul); return `${actual} ${materialLabels[m]}`; })
      .join(", ");
    return f.description + "\nYield: " + yieldStr + " per run";
  }
  return item.data.description + "\n" + item.data.benefitDescription;
}

function getButtonLabel(item: GoalItem): string {
  if (item.kind === "building") return item.data.buttonLabel;
  if (item.kind === "farm") return item.data.buttonLabel;
  return item.data.buttonLabel;
}

const matColorMap: Record<string, string> = {
  wood: "bg-amber-700",
  stone: "bg-stone-500",
  iron: "bg-gray-400",
  herbs: "bg-green-500",
  food: "bg-yellow-500",
  leather: "bg-amber-800",
  crystal: "bg-purple-500",
};

const matIconMap: Record<string, React.ReactNode> = {
  wood: <TreePine className="h-3 w-3" />,
  stone: <Mountain className="h-3 w-3" />,
  iron: <Pickaxe className="h-3 w-3" />,
  herbs: <Leaf className="h-3 w-3" />,
  food: <Apple className="h-3 w-3" />,
  leather: <PawPrint className="h-3 w-3" />,
  crystal: <Gem className="h-3 w-3" />,
};

const matTextColor: Record<string, string> = {
  wood: "text-amber-600",
  stone: "text-stone-400",
  iron: "text-gray-400",
  herbs: "text-green-400",
  food: "text-yellow-400",
  leather: "text-amber-500",
  crystal: "text-purple-400",
};

const itemArt: Record<string, string> = {
  "herb-garden": herbGarden,
};

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
  const [hoveredGoalCost, setHoveredGoalCost] = useState<string | null>(null);
  const [tooltipItemId, setTooltipItemId] = useState<string | null>(null);

  useEffect(() => {
    if (pendingFarmYield) onCollectFarmYield();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    for (const src of Object.values(itemArt)) {
      if (src) { const img = new Image(); img.src = src; }
    }
  }, []);

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

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "buildings", label: "Buildings", icon: <Hammer className="h-4 w-4" /> },
    { id: "farm", label: "Farm", icon: <Wheat className="h-4 w-4" /> },
    { id: "research", label: "Research", icon: <FlaskConical className="h-4 w-4" /> },
  ];

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
                {t.icon}
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
              <span style={{ color: matColorHex(mat) }}>{matIconMap[mat]}</span>
              <span className={cn("font-medium", matTextColor[mat])}>{materialInventory[mat] ?? 0}</span>
              <span className={matTextColor[mat]}>{materialLabels[mat]}</span>
            </span>
          ))}
        </div>

        {/* Grid of all items */}
        <AnimatedHeight deps={[tab, completed.join(","), materialInventory.wood, materialInventory.stone, materialInventory.iron, materialInventory.herbs, materialInventory.food, materialInventory.leather, materialInventory.crystal]}>
          <div className="mx-auto mt-6 grid w-full grid-cols-3 gap-4">
            {allItems.map((item, idx) => {
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
                  onMouseEnter={() => setTooltipItemId(item.data.id)}
                  onMouseLeave={() => setTooltipItemId(null)}
                >
                  {/* Title + Art frame */}
                  <div className="flex w-full flex-col items-center gap-0">
                    {/* Title */}
                    <p className="mb-2 w-full truncate text-center text-sm font-semibold text-foreground">
                      {item.data.title}
                    </p>

                    {/* Art frame — 80% width (20% smaller) */}
                    <div className={cn(
                      "flex aspect-[4/3] w-4/5 items-center justify-center overflow-hidden rounded-[18px] border",
                      isCompleted
                        ? "border-stone-600/70 bg-stone-800/70"
                        : "border-amber-700/60 bg-stone-900",
                    )}>
                      {itemArt[item.data.id] ? (
                        <img src={itemArt[item.data.id]} alt={item.data.title} className={cn("h-full w-full object-cover", isCompleted ? "grayscale" : "")} />
                      ) : (
                        <span className={cn(
                          "text-9xl font-black uppercase leading-none",
                          isCompleted ? "text-amber-700/30" : "text-amber-700/40",
                        )}>
                          {item.data.title[0]}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Persistent material costs — cost required (no progress), with icon and color */}
                  {!isCompleted && costItems.length > 0 && (
                    <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {costItems.map((mat) => {
                        const need = itemCost[mat];
                        return (
                          <span key={mat} className="flex items-center gap-1">
                            <span style={{ color: matColorHex(mat) }}>{matIconMap[mat]}</span>
                            <span className={cn("font-medium", matTextColor[mat])}>{need}</span>
                            <span className={matTextColor[mat]}>{materialLabels[mat]}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Info tooltip on hover — shows benefit for completed or full info for available */}
                  {tooltipItemId === item.data.id && (
                    <div className={cn(
                      "absolute z-40 rounded-xl border border-border/60 bg-card px-4 py-2.5 text-xs text-muted-foreground shadow-lg text-center leading-relaxed",
                      isCompleted ? "bottom-full mb-2 whitespace-nowrap" : "bottom-full mb-2 whitespace-pre-line",
                    )}>
                      {isCompleted
                        ? (item.kind === "building"
                            ? (item.data as HomesteadBuilding).benefitDescription
                            : item.kind === "research"
                              ? (item.data as HomesteadResearch).benefitDescription
                              : "Produces materials each run")
                        : getBenefitText(item, yieldMul)}
                    </div>
                  )}

                  {/* Action button — for all available (non-completed) items */}
                  {!isCompleted && (() => {
                    const hasCost = MATERIAL_IDS.some((m) => (itemCost[m] ?? 0) > 0);
                    return hasCost ? (
                      <div className="relative mt-3">
                        <Button
                          size="sm"
                          variant={itemAffordable ? "default" : "outline"}
                          disabled={!itemAffordable}
                          onMouseEnter={() => setHoveredGoalCost(item.data.id)}
                          onMouseLeave={() => setHoveredGoalCost(null)}
                          onClick={() => handleAction(item)}
                        >
                          {getButtonLabel(item)}
                        </Button>

                        {/* "Not Enough Materials" tooltip when button is disabled */}
                        {hoveredGoalCost === item.data.id && !itemAffordable && (
                          <div className="absolute bottom-full left-1/2 z-40 mb-2 -translate-x-1/2 rounded-lg border border-border/50 bg-card px-3 py-2 text-xs text-muted-foreground shadow-lg whitespace-nowrap">
                            Not Enough Materials
                          </div>
                        )}
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

function matColorHex(mat: string): string {
  const colors: Record<string, string> = {
    wood: "#8B5E3C",
    stone: "#6B7280",
    iron: "#9CA3AF",
    herbs: "#22C55E",
    food: "#EAB308",
    leather: "#A16207",
    crystal: "#A855F7",
  };
  return colors[mat] ?? "#6B7280";
}
