// Shared material icon and color utilities for reward/UI screens.
import type { ReactNode } from "react";
import { Apple, Gem, Leaf, Mountain, PawPrint, Pickaxe, TreePine } from "lucide-react";

import type { MaterialId } from "@/lib/homestead/types";

export const matIconMap: Record<MaterialId, ReactNode> = {
  wood: <TreePine className="h-4 w-4" />,
  stone: <Mountain className="h-4 w-4" />,
  iron: <Pickaxe className="h-4 w-4" />,
  herbs: <Leaf className="h-4 w-4" />,
  food: <Apple className="h-4 w-4" />,
  leather: <PawPrint className="h-4 w-4" />,
  crystal: <Gem className="h-4 w-4" />,
};

export const matTextColor: Record<MaterialId, string> = {
  wood: "text-amber-600",
  stone: "text-stone-400",
  iron: "text-gray-400",
  herbs: "text-green-600",
  food: "text-red-400",
  leather: "text-amber-500",
  crystal: "text-sky-400",
};

export function matColorHex(mat: MaterialId): string {
  const colors: Record<MaterialId, string> = {
    wood: "#8B5E3C",
    stone: "#78716C",
    iron: "#9CA3AF",
    herbs: "#15803D",
    food: "#EF4444",
    leather: "#D97706",
    crystal: "#38BDF8",
  };
  return colors[mat] ?? "#6B7280";
}

export function MaterialIcon({ material, className }: { material: MaterialId; className?: string }) {
  const icons: Record<MaterialId, ReactNode> = {
    wood: <TreePine className={className ?? "h-4 w-4"} />,
    stone: <Mountain className={className ?? "h-4 w-4"} />,
    iron: <Pickaxe className={className ?? "h-4 w-4"} />,
    herbs: <Leaf className={className ?? "h-4 w-4"} />,
    food: <Apple className={className ?? "h-4 w-4"} />,
    leather: <PawPrint className={className ?? "h-4 w-4"} />,
    crystal: <Gem className={className ?? "h-4 w-4"} />,
  };
  return icons[material];
}
