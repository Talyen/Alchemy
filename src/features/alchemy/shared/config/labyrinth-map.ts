// Labyrinth map node chrome: icons, colors, and shine palettes per node type.
import { Crown, DoorOpen, FlaskConical, Gem, Hammer, Heart, ShoppingCart, Skull, Sparkles, Swords } from "lucide-react";

import type { LabyrinthNodeType } from "@/lib/content-systems/types";

import { SHINE_PALETTES } from "./shine-palettes";

export interface LabyrinthNodeMeta {
  icon: React.ComponentType<{ className?: string }>;
  className: string;
  shineColors: string[];
}

export const LABYRINTH_NODE_META: Record<LabyrinthNodeType, LabyrinthNodeMeta> = {
  entrance: {
    icon: DoorOpen,
    className: "bg-black text-stone-600",
    shineColors: [...SHINE_PALETTES.labyrinth.entrance],
  },
  combat: {
    icon: Swords,
    className: "bg-black text-red-500",
    shineColors: [...SHINE_PALETTES.labyrinth.combat],
  },
  elite: {
    icon: Skull,
    className: "bg-black text-violet-500",
    shineColors: [...SHINE_PALETTES.labyrinth.elite],
  },
  rest: {
    icon: Heart,
    className: "bg-black text-orange-500",
    shineColors: [...SHINE_PALETTES.labyrinth.rest],
  },
  mystery: {
    icon: Sparkles,
    className: "bg-black text-zinc-400",
    shineColors: [...SHINE_PALETTES.labyrinth.mystery],
  },
  shop: {
    icon: ShoppingCart,
    className: "bg-black text-yellow-500",
    shineColors: [...SHINE_PALETTES.labyrinth.shop],
  },
  alchemist: {
    icon: FlaskConical,
    className: "bg-black text-emerald-500",
    shineColors: [...SHINE_PALETTES.labyrinth.alchemist],
  },
  "trinket-shop": {
    icon: Gem,
    className: "bg-black text-violet-500",
    shineColors: [...SHINE_PALETTES.labyrinth["trinket-shop"]],
  },
  "equipment-shop": {
    icon: Hammer,
    className: "bg-black text-slate-400",
    shineColors: [...SHINE_PALETTES.labyrinth["equipment-shop"]],
  },
  boss: {
    icon: Crown,
    className: "bg-black text-red-400",
    shineColors: [...SHINE_PALETTES.labyrinth.boss],
  },
};
