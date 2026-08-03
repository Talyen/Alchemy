// Shared material icon and color utilities for reward/UI screens.
/* eslint-disable react-refresh/only-export-components -- co-located MaterialIcon component and icon/color constants */
import type { ReactNode } from "react";
import { Apple, Coins, Gem, Leaf, Pickaxe, TreePine } from "lucide-react";

import { cn } from "@/lib/utils";
import { materialLabels, type MaterialId } from "@/lib/homestead/types";

const MAT_ICON_CLASS = "block h-6 w-6 shrink-0";

export const matIconMap: Record<MaterialId, ReactNode> = {
  wood: <TreePine absoluteStrokeWidth aria-hidden="true" className={MAT_ICON_CLASS} />,
  iron: <Pickaxe absoluteStrokeWidth aria-hidden="true" className={MAT_ICON_CLASS} />,
  herbs: <Leaf absoluteStrokeWidth aria-hidden="true" className={MAT_ICON_CLASS} />,
  food: <Apple absoluteStrokeWidth aria-hidden="true" className={MAT_ICON_CLASS} />,
  crystal: <Gem absoluteStrokeWidth aria-hidden="true" className={MAT_ICON_CLASS} />,
};

export const matTextColor: Record<MaterialId, string> = {
  wood: "text-amber-600",
  iron: "text-gray-400",
  herbs: "text-green-600",
  food: "text-red-400",
  crystal: "text-sky-400",
};

export const matPillStyle: Record<MaterialId, string> = {
  wood: "bg-amber-600/15",
  iron: "bg-gray-400/[0.12]",
  herbs: "bg-green-600/15",
  food: "bg-red-400/15",
  crystal: "bg-sky-400/15",
};

export function MaterialIcon({ material, className }: { material: MaterialId; className?: string }) {
  const iconClassName = cn(MAT_ICON_CLASS, className);
  const icons: Record<MaterialId, ReactNode> = {
    wood: <TreePine absoluteStrokeWidth aria-hidden="true" className={cn("text-amber-600", iconClassName)} />,
    iron: <Pickaxe absoluteStrokeWidth aria-hidden="true" className={cn("text-gray-400", iconClassName)} />,
    herbs: <Leaf absoluteStrokeWidth aria-hidden="true" className={cn("text-green-600", iconClassName)} />,
    food: <Apple absoluteStrokeWidth aria-hidden="true" className={cn("text-red-400", iconClassName)} />,
    crystal: <Gem absoluteStrokeWidth aria-hidden="true" className={cn("text-sky-400", iconClassName)} />,
  };
  return icons[material];
}

export function MaterialPill({ material, amount }: { material: MaterialId; amount: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-base font-semibold",
        matPillStyle[material],
        matTextColor[material],
      )}
    >
      {matIconMap[material]}
      {amount} {materialLabels[material]}
    </span>
  );
}

export function GoldPill({ amount }: { amount: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-yellow-300/15 px-4 py-1.5 text-base font-semibold text-yellow-300">
      <Coins className="h-6 w-6" />
      {amount} Gold
    </span>
  );
}
