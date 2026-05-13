// Shared material icon and color utilities for reward/UI screens.
import type { ReactNode } from "react";
import { Apple, Gem, Leaf, Pickaxe, TreePine } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MaterialId } from "@/lib/homestead/types";

export const matIconMap: Record<MaterialId, ReactNode> = {
  wood: <TreePine className="h-4 w-4" />,
  iron: <Pickaxe className="h-4 w-4" />,
  herbs: <Leaf className="h-4 w-4" />,
  food: <Apple className="h-4 w-4" />,
  crystal: <Gem className="h-4 w-4" />,
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
  const icons: Record<MaterialId, ReactNode> = {
    wood: <TreePine className={cn("text-amber-600", className ?? "h-4 w-4")} />,
    iron: <Pickaxe className={cn("text-gray-400", className ?? "h-4 w-4")} />,
    herbs: <Leaf className={cn("text-green-600", className ?? "h-4 w-4")} />,
    food: <Apple className={cn("text-red-400", className ?? "h-4 w-4")} />,
    crystal: <Gem className={cn("text-sky-400", className ?? "h-4 w-4")} />,
  };
  return icons[material];
}
