/* eslint-disable react-refresh/only-export-components */
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  MATERIAL_IDS,
  type HomesteadBuilding,
  type HomesteadFarm,
  type HomesteadResearch,
  type MaterialId,
  type MaterialInventory,
  materialLabels,
} from "@/lib/homestead/types";
import { MaterialIcon, MaterialPill, matIconMap, matPillStyle, matTextColor } from "../../ui/material-icons";
import { keywordDefinitions } from "@/lib/game-data";
import { TabBar } from "../../ui/tab-bar";
import { Hammer, Wheat, FlaskConical, PawPrint } from "lucide-react";
import { tokenizeDescription } from "../../utils";
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

export type Tab = "buildings" | "companions" | "farm" | "research";

export type GoalItem =
  | { kind: "building"; data: HomesteadBuilding }
  | { kind: "farm"; data: HomesteadFarm }
  | { kind: "research"; data: HomesteadResearch };

export const HOMESTEAD_CONFIG = {
  companionPageSize: 6,
  artAspectRatio: "aspect-[4/3]",
  companionAspectRatio: "aspect-[3/4]",
  companionPageWidth: "w-[65%]",
  compilationFillerCount: 3,
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
};

export function getArt(id: string): string {
  return itemArt[id] ?? placeholderHomestead;
}

export function MaterialCost({ material, amount }: { material: MaterialId; amount: number }) {
  return (
    <span className="ml-1.5 inline-flex h-5 shrink-0 items-center gap-1 leading-none">
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden">
        <MaterialIcon material={material} />
      </span>
      <span className={cn("tabular-nums leading-none", matTextColor[material])}>{amount}</span>
    </span>
  );
}

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
                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold align-middle",
                matPillStyle[mat],
                matTextColor[mat],
              )}
            >
              {matIconMap[mat]}
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

export function MaterialsBar({ materialInventory }: { materialInventory: MaterialInventory }) {
  return (
    <div className="mx-auto mt-5 mb-4 flex w-full max-w-2xl flex-nowrap items-center justify-center gap-x-3">
      {MATERIAL_IDS.map((mat) => (
        <MaterialPill key={mat} material={mat} amount={materialInventory[mat] ?? 0} />
      ))}
    </div>
  );
}

const tabs: { id: Tab; label: string; icon: typeof Hammer }[] = [
  { id: "buildings", label: "Buildings", icon: Hammer },
  { id: "farm", label: "Farm", icon: Wheat },
  { id: "research", label: "Research", icon: FlaskConical },
  { id: "companions", label: "Companions", icon: PawPrint },
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
