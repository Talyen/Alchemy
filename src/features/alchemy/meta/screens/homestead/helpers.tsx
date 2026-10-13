import { Fragment, type ReactNode } from "react";
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
  type BuildingId,
  type FarmId,
  type HomesteadBuilding,
  type HomesteadFarm,
  type HomesteadResearch,
  type ResearchId,
  materialLabels,
} from "@/lib/homestead/types";
import { MaterialInlineChip, type HomesteadResource } from "../../../shared/ui/material-icons";
import { TabBar } from "../../../shared/ui/tab-bar";
import { renderTokenizedDescription, type TokenizedTextOptions } from "../../../shared/ui/cards/card-description-ui";
import { Hammer, Wheat, FlaskConical, PawPrint } from "lucide-react";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";

export type Tab = "buildings" | "companions" | "farm" | "research";

type HomesteadUpgradeId = BuildingId | FarmId | ResearchId;

export type GoalItem =
  | { kind: "building"; data: HomesteadBuilding }
  | { kind: "farm"; data: HomesteadFarm }
  | { kind: "research"; data: HomesteadResearch };

export const HOMESTEAD_CONFIG = {
  companionPageSize: 8,
  upgradePageSize: 6,
  landscapeNodeWidth: 430,
} as const;

const itemArt = {
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
} satisfies Record<HomesteadUpgradeId, string>;

export function getArt(id: string): string {
  return (itemArt as Record<string, string>)[id] ?? "";
}

const LABEL_TO_RESOURCE: Record<string, HomesteadResource> = {
  ...Object.fromEntries(MATERIAL_IDS.map((material) => [materialLabels[material], material])),
  Gold: "gold",
};
const RESOURCE_REGEX = new RegExp(`\\b(${Object.keys(LABEL_TO_RESOURCE).join("|")})\\b`, "g");

export function renderTextWithMaterials(text: string, options?: TokenizedTextOptions): ReactNode {
  // Resources include Gold, which the keyword renderer would otherwise consume.
  return text.split(RESOURCE_REGEX).map((part, index) => {
    const resource = LABEL_TO_RESOURCE[part];
    return resource ? (
      <MaterialInlineChip key={index} material={resource} label={part} />
    ) : (
      <Fragment key={index}>{renderTokenizedDescription(part, options)}</Fragment>
    );
  });
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

export const BUILDING_GOAL_ITEMS: readonly GoalItem[] = buildings.map((data) => ({ kind: "building", data }));
export const FARM_GOAL_ITEMS: readonly GoalItem[] = farmPlots.map((data) => ({ kind: "farm", data }));
export const RESEARCH_GOAL_ITEMS: readonly GoalItem[] = researchUpgrades.map((data) => ({ kind: "research", data }));
