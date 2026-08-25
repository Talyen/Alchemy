/* eslint-disable react-refresh/only-export-components -- co-located homestead screen subcomponents and tab helpers */
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
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
  materialLabels,
} from "@/lib/homestead/types";
import { tooltipChipClass } from "../../../shared/config";
import { MaterialIcon, matPillStyle, matTextColor } from "../../../shared/ui/material-icons";
import { TabBar } from "../../../shared/ui/tab-bar";
import { renderTokenizedDescription } from "../../../shared/ui/card-description-ui";
import { Hammer, Wheat, FlaskConical, PawPrint } from "lucide-react";

export type Tab = "buildings" | "companions" | "farm" | "research";

export type GoalItem =
  | { kind: "building"; data: HomesteadBuilding }
  | { kind: "farm"; data: HomesteadFarm }
  | { kind: "research"; data: HomesteadResearch };

export const HOMESTEAD_CONFIG = {
  companionPageSize: 4,
  artAspectRatio: "aspect-[4/3]",
  companionAspectRatio: "aspect-[3/4]",
  companionPageWidth: "w-full",
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

export { MaterialCost, HomesteadResourceWallet as MaterialsBar } from "../../../shared/ui/material-icons";

const MATERIAL_LABELS_LIST = MATERIAL_IDS.map((m) => materialLabels[m]);
const MATERIAL_REGEX = new RegExp(`\\b(${MATERIAL_LABELS_LIST.join("|")})\\b`, "g");

function renderMaterialPills(text: string, key: number): ReactNode {
  return text.split(MATERIAL_REGEX).map((sub, index) => {
    const mat = MATERIAL_IDS.find((m) => materialLabels[m] === sub);
    if (!mat) return <span key={`${key}-${index}`}>{sub}</span>;
    return (
      <span
        key={`${key}-${index}`}
        className={cn(
          "mx-1 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 align-baseline shadow-xs",
          tooltipChipClass,
          "leading-none",
          matPillStyle[mat],
          matTextColor[mat],
        )}
      >
        <MaterialIcon material={mat} size="xs" />
        <span className="leading-none">{sub}</span>
      </span>
    );
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

export function getItems(tab: Tab, pool: HomesteadBuilding[] | HomesteadFarm[] | HomesteadResearch[]): GoalItem[] {
  return pool.map((data) => {
    if (tab === "buildings") return { kind: "building" as const, data: data as HomesteadBuilding };
    if (tab === "farm") return { kind: "farm" as const, data: data as HomesteadFarm };
    return { kind: "research" as const, data: data as HomesteadResearch };
  });
}
