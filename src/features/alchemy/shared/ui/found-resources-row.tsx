// Shared gold / material reward row of standalone resource pills.
import { MATERIAL_IDS, type MaterialId } from "@/lib/homestead/types";
import { cn } from "@/lib/utils";

import { GoldPill, MaterialPill } from "./material-icons";

export function FoundResourcesRow({
  gold = 0,
  materials,
  size = "md",
  className,
}: {
  gold?: number;
  materials?: Partial<Record<MaterialId, number>>;
  size?: "md" | "lg";
  className?: string;
}) {
  const earnedMaterials = MATERIAL_IDS.filter((mat) => (materials?.[mat] ?? 0) > 0);
  if (gold <= 0 && earnedMaterials.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-3", className)}>
      {gold > 0 ? <GoldPill amount={gold} showsIncreasePrefix size={size} /> : null}
      {earnedMaterials.map((mat) => (
        <MaterialPill key={mat} material={mat} amount={materials![mat]!} showsIncreasePrefix size={size} />
      ))}
    </div>
  );
}
