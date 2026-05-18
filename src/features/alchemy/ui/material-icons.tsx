// Shared material icon and color utilities for reward/UI screens.
import type { ReactNode } from "react";
import { Apple, Gem, Leaf, Pickaxe, TreePine } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MaterialId } from "@/lib/homestead/types";

export const matIconMap: Record<MaterialId, ReactNode> = {
  wood: <TreePine absoluteStrokeWidth aria-hidden="true" className="block h-4 w-4 shrink-0" />,
  iron: <Pickaxe absoluteStrokeWidth aria-hidden="true" className="block h-4 w-4 shrink-0" />,
  herbs: <Leaf absoluteStrokeWidth aria-hidden="true" className="block h-4 w-4 shrink-0" />,
  food: <Apple absoluteStrokeWidth aria-hidden="true" className="block h-4 w-4 shrink-0" />,
  crystal: <Gem absoluteStrokeWidth aria-hidden="true" className="block h-4 w-4 shrink-0" />,
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
  const iconClassName = cn("block h-4 w-4 shrink-0", className);
  const icons: Record<MaterialId, ReactNode> = {
    wood: <TreePine absoluteStrokeWidth aria-hidden="true" className={cn("text-amber-600", iconClassName)} />,
    iron: <Pickaxe absoluteStrokeWidth aria-hidden="true" className={cn("text-gray-400", iconClassName)} />,
    herbs: <Leaf absoluteStrokeWidth aria-hidden="true" className={cn("text-green-600", iconClassName)} />,
    food: <Apple absoluteStrokeWidth aria-hidden="true" className={cn("text-red-400", iconClassName)} />,
    crystal: <Gem absoluteStrokeWidth aria-hidden="true" className={cn("text-sky-400", iconClassName)} />,
  };
  return icons[material];
}
