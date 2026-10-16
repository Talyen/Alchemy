import { useGameTranslation } from "@/components/use-game-translation";

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
  type BuildingId,
  type FarmId,
  type HomesteadBuilding,
  type HomesteadFarm,
  type HomesteadResearch,
  type ResearchId,
} from "@/lib/homestead/types";
import { MaterialInlineChip, type HomesteadResource } from "../../../shared/ui/material-icons";
import { TabBar } from "../../../shared/ui/tab-bar";
import { renderMessage, type TokenizedTextOptions } from "../../../shared/ui/localized-description";
import { buildDescriptionMessage } from "@/lib/game-data";
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

export function renderTextWithMaterials(text: string, options?: TokenizedTextOptions): ReactNode {
  return renderMessage(buildDescriptionMessage([{ text }], true), {
    ...options,
    renderResource: (label, resourceId, key) => (
      <MaterialInlineChip key={key} material={resourceId as HomesteadResource} label={label} />
    ),
  });
}

const tabs: Array<{ id: Tab; label: string; icon: typeof Hammer; iconClassName: string }> = [
  { id: "buildings", label: "Buildings", icon: Hammer, iconClassName: keywordDefinitions.physical.colorClass },
  { id: "farm", label: "Farm", icon: Wheat, iconClassName: "text-primary" },
  { id: "research", label: "Research", icon: FlaskConical, iconClassName: keywordDefinitions.poison.colorClass },
  { id: "companions", label: "Companions", icon: PawPrint, iconClassName: keywordDefinitions.companion.colorClass },
];

export function HomesteadTabs({ activeTab, onSelectTab }: { activeTab: Tab; onSelectTab: (tab: Tab) => void }) {
  useGameTranslation();
  return <TabBar tabs={tabs} activeTab={activeTab} onSelectTab={onSelectTab} />;
}

export const BUILDING_GOAL_ITEMS: readonly GoalItem[] = buildings.map((data) => ({ kind: "building", data }));
export const FARM_GOAL_ITEMS: readonly GoalItem[] = farmPlots.map((data) => ({ kind: "farm", data }));
export const RESEARCH_GOAL_ITEMS: readonly GoalItem[] = researchUpgrades.map((data) => ({ kind: "research", data }));
