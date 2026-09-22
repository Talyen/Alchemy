import { type ReactNode } from "react";
import {
  agilityTraining,
  alchemyLab,
  archeryRange,
  blacksmithsForge,
  botanicalDistillation,
  chickenCoop,
  companionSanctuary,
  crystalGarden,
  culinaryArts,
  detectMagic,
  herbGarden,
  homesteadWishingWell,
  huntersLodge,
  keywordDefinitions,
  leylineEnergy,
  library,
  mycologyCellar,
  orchard,
  pasture,
  runesmithsWorkshop,
  sparringGrounds,
  transmutationCrucible,
  wheatField,
  woolTailoring,
} from "@/lib/game-data";
import {
  MATERIAL_IDS,
  type HomesteadBuilding,
  type HomesteadFarm,
  type HomesteadResearch,
  type MaterialId,
  type MaterialInventory,
  materialLabels,
} from "@/lib/homestead/types";
import { MaterialInlineChip } from "../../../shared/ui/material-icons";
import { TabBar } from "../../../shared/ui/tab-bar";
import { renderTokenizedDescription } from "../../../shared/ui/cards/card-description-ui";
import { Hammer, Wheat, FlaskConical, PawPrint } from "lucide-react";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { extractKeywordIds } from "@/lib/keyword-text";
import { getInspectionKeywordShineColors } from "@/features/alchemy/shared/config";

export type Tab = "buildings" | "companions" | "farm" | "research";

export type GoalItem =
  | { kind: "building"; data: HomesteadBuilding }
  | { kind: "farm"; data: HomesteadFarm }
  | { kind: "research"; data: HomesteadResearch };

export const HOMESTEAD_CONFIG = {
  companionPageSize: 8,
  upgradePageSize: 6,
  hoverScope: "homestead",
} as const;

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
  "runesmiths-workshop": runesmithsWorkshop,
  "companion-sanctuary": companionSanctuary,
  "wishing-well": homesteadWishingWell,
  "transmutation-crucible": transmutationCrucible,
  "mycology-cellar": mycologyCellar,
  "sparring-grounds": sparringGrounds,
  "archery-range": archeryRange,
  library: library,
  "leyline-energy": leylineEnergy,
  "detect-magic": detectMagic,
  "botanical-distillation": botanicalDistillation,
  "culinary-arts": culinaryArts,
  "wool-tailoring": woolTailoring,
  "agility-training": agilityTraining,
};

export function getArt(id: string): string {
  return itemArt[id] ?? "";
}

export { HomesteadResourceWallet as MaterialsBar } from "../../../shared/ui/material-icons";

const LABEL_TO_MATERIAL: Record<string, MaterialId> = Object.fromEntries(
  MATERIAL_IDS.map((m) => [materialLabels[m], m]),
);
const MATERIAL_LABELS_LIST = MATERIAL_IDS.map((m) => materialLabels[m]);
const MATERIAL_REGEX = new RegExp(`\\b(${MATERIAL_LABELS_LIST.join("|")})\\b`, "g");

function renderMaterialPills(text: string, key: number): ReactNode {
  return text.split(MATERIAL_REGEX).map((sub, index) => {
    const mat = LABEL_TO_MATERIAL[sub];
    if (!mat) return <span key={`${key}-${index}`}>{sub}</span>;
    return <MaterialInlineChip key={`${key}-${index}`} material={mat} label={sub} />;
  });
}

export function renderTextWithMaterials(text: string): ReactNode {
  return renderTokenizedDescription(text, { renderPlain: renderMaterialPills });
}

const tabs: Array<{ id: Tab; label: string; icon: typeof Hammer; iconClassName: string }> = [
  { id: "buildings", label: "Buildings", icon: Hammer, iconClassName: keywordDefinitions.physical.colorClass },
  { id: "farm", label: "Farm", icon: Wheat, iconClassName: "text-primary" },
  { id: "research", label: "Research", icon: FlaskConical, iconClassName: keywordDefinitions.poison.colorClass },
  { id: "companions", label: "Companions", icon: PawPrint, iconClassName: keywordDefinitions.companion.colorClass },
];

export function HomesteadTabs({ activeTab, onSelectTab }: { activeTab: Tab; onSelectTab: (tab: Tab) => void }) {
  return <TabBar tabs={tabs} activeTab={activeTab} onSelectTab={onSelectTab} />;
}

export function formatMaterialCostSummary(cost: MaterialInventory): string {
  const parts = MATERIAL_IDS.filter((m) => (cost[m] ?? 0) > 0).map((m) => `${cost[m] ?? 0} ${materialLabels[m]}`);
  return parts.join(", ");
}

export const BUILDING_GOAL_ITEMS: readonly GoalItem[] = buildings.map((data) => ({ kind: "building", data }));
export const FARM_GOAL_ITEMS: readonly GoalItem[] = farmPlots.map((data) => ({ kind: "farm", data }));
export const RESEARCH_GOAL_ITEMS: readonly GoalItem[] = researchUpgrades.map((data) => ({ kind: "research", data }));

const upgradeShineColorsCache = new Map<string, readonly string[]>();

export function getHomesteadUpgradeShineColors(item: GoalItem): readonly string[] {
  const cached = upgradeShineColorsCache.get(item.data.id);
  if (cached) return cached;
  const text = item.data.tiers
    .flatMap((tier) => [tier.benefitDescription, tier.nonCombatBenefitDescription ?? ""])
    .filter(Boolean)
    .join("\n");
  const colors = getInspectionKeywordShineColors(extractKeywordIds(text));
  upgradeShineColorsCache.set(item.data.id, colors);
  return colors;
}
