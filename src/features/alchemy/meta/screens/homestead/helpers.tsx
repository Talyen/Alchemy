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
import { Hammer, Wheat, FlaskConical, PawPrint } from "lucide-react";
import { tokenizeDescription } from "../../../shared/utils";

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
const MATERIAL_REGEX = new RegExp(`(${MATERIAL_LABELS_LIST.join("|")})`, "g");

export function renderTextWithMaterials(text: string): ReactNode {
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
      const materialParts = part.text.split(MATERIAL_REGEX);
      for (const sub of materialParts) {
        const mat = MATERIAL_IDS.find((m) => materialLabels[m] === sub);
        if (mat) {
          result.push(
            <span
              key={result.length}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 align-middle shadow-xs",
                tooltipChipClass,
                matPillStyle[mat],
                matTextColor[mat],
              )}
            >
              <MaterialIcon material={mat} size="sm" className="inline-block" />
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
