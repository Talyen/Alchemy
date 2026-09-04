import { type ReactNode } from "react";
import {
  agilityTraining,
  alchemyLab,
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
  orchard,
  pasture,
  runesmithsWorkshop,
  wheatField,
  woolTailoring,
} from "@/lib/game-data";
import {
  MATERIAL_IDS,
  type HomesteadBuilding,
  type HomesteadFarm,
  type HomesteadResearch,
  type MaterialInventory,
  materialLabels,
} from "@/lib/homestead/types";
import { MaterialInlineChip } from "../../../shared/ui/material-icons";
import { TabBar } from "../../../shared/ui/tab-bar";
import { renderTokenizedDescription } from "../../../shared/ui/card-description-ui";
import { Hammer, Wheat, FlaskConical, PawPrint } from "lucide-react";

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

const MATERIAL_LABELS_LIST = MATERIAL_IDS.map((m) => materialLabels[m]);
const MATERIAL_REGEX = new RegExp(`\\b(${MATERIAL_LABELS_LIST.join("|")})\\b`, "g");

function renderMaterialPills(text: string, key: number): ReactNode {
  return text.split(MATERIAL_REGEX).map((sub, index) => {
    const mat = MATERIAL_IDS.find((m) => materialLabels[m] === sub);
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

export function getItems(tab: Tab, pool: HomesteadBuilding[] | HomesteadFarm[] | HomesteadResearch[]): GoalItem[] {
  if (tab === "farm") return (pool as HomesteadFarm[]).map((data) => ({ kind: "farm", data }));
  if (tab === "research") return (pool as HomesteadResearch[]).map((data) => ({ kind: "research", data }));
  return (pool as HomesteadBuilding[]).map((data) => ({ kind: "building", data }));
}
