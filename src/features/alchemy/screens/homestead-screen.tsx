// Homestead screen — persistent progression hub with sequential unlocking.
// Goals displayed in a 3-column grid. Only the current goal is actionable;
// remaining cells show full-size artwork in a dimmed state.

import { useEffect, useState } from "react";
import { House, Swords, Hammer, Wheat, Sprout, Check, FlaskConical, Lock } from "lucide-react";

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
  const goalIdx = allItems.findIndex((item) => !(completed as string[]).includes(item.data.id));
  const goal = goalIdx >= 0 ? allItems[goalIdx] : null;
  const doneCount = completed.length;
  const total = totalCount(tab);

  const costReduction = tab === "buildings" ? effects.buildingCostReduction : 0;
  const yieldMul = tab === "farm" ? 1 + effects.farmYieldMultiplier : 1;

  const goalCost = goal ? getEffectiveCost(goal.data.cost, costReduction) : null;
  const goalAffordable = goalCost ? canAfford(materialInventory, goalCost) : false;
  const goalBenefit = goal ? getBenefitText(goal, yieldMul) : "";

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
      <div className="alchemy-shell relative flex min-h-[520px] w-full max-w-3xl flex-col rounded-[28px] px-6 py-7 sm:px-8">
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

        {/* Materials bar at top */}
        <div className="mx-auto mt-4 flex w-full max-w-xl flex-wrap justify-center gap-x-5 gap-y-1.5">
          {MATERIAL_IDS.map((mat) => (
            <span key={mat} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: matColorHex(mat) }} />
              <span className="font-medium text-foreground">{materialInventory[mat] ?? 0}</span>
              <span className="text-muted-foreground/50">{materialLabels[mat]}</span>
            </span>
          ))}
        </div>

        {/* Tabs */}
        <div className="mx-auto mt-5 flex gap-2">
          {tabs.map((t) => {
            const tCount = t.id === "buildings" ? constructedBuildings.length : t.id === "farm" ? plantedFarms.length : completedResearch.length;
            const tTotal = totalCount(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  tab === t.id
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground/40 hover:text-muted-foreground/70",
                )}
              >
                {t.icon}
                {t.label}
                <span className="ml-0.5 text-[11px] opacity-60">{tCount}/{tTotal}</span>
              </button>
            );
          })}
        </div>

        {/* Grid of all items */}
        <AnimatedHeight deps={[tab, completed.join(","), materialInventory.wood, materialInventory.stone, materialInventory.iron, materialInventory.herbs, materialInventory.food, materialInventory.leather, materialInventory.crystal]}>
          <div className="mx-auto mt-6 grid w-full grid-cols-3 gap-4">
            {allItems.map((item, idx) => {
              const isCompleted = (completed as string[]).includes(item.data.id);
              const isGoal = item === goal;
              const isUndiscovered = !isCompleted && !isGoal;

              return (
                <div
                  key={item.data.id}
                  className={cn(
                    "relative flex flex-col items-center gap-0",
                    isUndiscovered && "opacity-40",
                    isCompleted && "opacity-55",
                  )}
                  onMouseEnter={() => setTooltipItemId(item.data.id)}
                  onMouseLeave={() => setTooltipItemId(null)}
                >
                  {/* Status badge */}
                  {isCompleted && (
                    <div className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600/80">
                      <Check className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                  {isUndiscovered && (
                    <div className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-stone-700/60">
                      <Lock className="h-3.5 w-3.5 text-stone-400" />
                    </div>
                  )}

                  {/* Title */}
                  <p className={cn("mb-2 text-sm font-semibold", isUndiscovered ? "text-muted-foreground/40" : "text-foreground")}>
                    {item.data.title}
                  </p>

                  {/* Art frame — 4:3 matching destination art ratio */}
                  <div className={cn(
                    "w-full overflow-hidden rounded-[18px] border bg-gradient-to-b",
                    isCompleted
                      ? "border-border/30 from-amber-950/30 to-stone-950/50"
                      : isUndiscovered
                        ? "border-border/20 from-stone-900/20 to-stone-950/30"
                        : "border-border/40 from-amber-950/50 to-stone-950/70",
                  )}>
                    <div className="flex aspect-[4/3] w-full items-center justify-center">
                      <span className={cn(
                        "text-3xl font-black uppercase tracking-[0.12em] sm:text-4xl",
                        isCompleted
                          ? "text-amber-600/25"
                          : isUndiscovered
                            ? "text-amber-600/15"
                            : "text-amber-600/30",
                      )}>
                        {item.data.title[0]}
                      </span>
                    </div>
                  </div>

                  {/* Info tooltip on hover (description/benefit for goal, unlock hint for undiscovered) */}
                  {tooltipItemId === item.data.id && (
                    <div className={cn(
                      "absolute z-40 rounded-xl border border-border/60 bg-card px-4 py-2.5 text-xs text-muted-foreground shadow-lg text-center leading-relaxed",
                      isCompleted ? "bottom-full mb-2 whitespace-nowrap" : "bottom-full mb-2 whitespace-pre-line",
                    )}>
                      {isGoal
                        ? goalBenefit
                        : isUndiscovered
                          ? getButtonLabel(goal!) + " \u201c" + (goal?.data.title ?? "") + "\u201d to unlock"
                          : item.kind === "building"
                            ? (item.data as HomesteadBuilding).benefitDescription
                            : item.kind === "research"
                              ? (item.data as HomesteadResearch).benefitDescription
                              : "Produces materials each run"}
                    </div>
                  )}

                  {/* Action button — only for the current goal */}
                  {isGoal && goalCost && (() => {
                    const hasCost = MATERIAL_IDS.some((m) => (goalCost[m] ?? 0) > 0);
                    return hasCost ? (
                      <div className="relative mt-3">
                        <Button
                          size="sm"
                          variant={goalAffordable ? "default" : "outline"}
                          disabled={!goalAffordable}
                          onMouseEnter={() => setHoveredGoalCost(item.data.id)}
                          onMouseLeave={() => setHoveredGoalCost(null)}
                          onClick={() => handleAction(item)}
                        >
                          {getButtonLabel(item)}
                        </Button>

                        {/* Cost tooltip on hover over button */}
                        {hoveredGoalCost === item.data.id && (
                          <div className="absolute bottom-full left-1/2 z-40 mb-2 -translate-x-1/2 rounded-lg border border-border/50 bg-card px-3 py-2 shadow-lg">
                            {MATERIAL_IDS.filter((m) => (goalCost[m] ?? 0) > 0).map((mat) => {
                              const have = materialInventory[mat] ?? 0;
                              const need = goalCost[mat];
                              const pct = Math.min(100, Math.round((have / need) * 100));
                              return (
                                <div key={mat} className="flex items-center gap-2 text-[11px] whitespace-nowrap">
                                  <span className="w-10 text-right text-muted-foreground/70">{materialLabels[mat]}</span>
                                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-foreground/10">
                                    <div
                                      className={cn("h-full rounded-full", matColorMap[mat])}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className={cn("w-12 text-left tabular-nums", have >= need ? "text-foreground" : "text-muted-foreground/60")}>
                                    {have}/{need}
                                  </span>
                                </div>
                              );
                            })}
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
        {!goal && doneCount === total && total > 0 && (
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
