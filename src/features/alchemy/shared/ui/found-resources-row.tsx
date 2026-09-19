import { MATERIAL_IDS, type MaterialId } from "@/lib/homestead/types";
import { cn } from "@/lib/utils";

import { ResourcePill } from "./material-icons";

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
      {gold > 0 ? (
        <ResourcePill resource="gold" amount={gold} showsIncreasePrefix fillsAvailableWidth={false} size={size} />
      ) : null}
      {earnedMaterials.map((mat) => (
        <ResourcePill
          key={mat}
          resource={mat}
          amount={materials?.[mat] ?? 0}
          showsIncreasePrefix
          fillsAvailableWidth={false}
          size={size}
        />
      ))}
    </div>
  );
}
