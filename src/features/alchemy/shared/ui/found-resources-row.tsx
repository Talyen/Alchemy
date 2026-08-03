// Shared "Found" gold / material summary row for reward and run-end surfaces.
import { MATERIAL_IDS, type MaterialId } from "@/lib/homestead/types";
import { cn } from "@/lib/utils";

import { GoldPill, MaterialPill } from "./material-icons";

export function FoundResourcesRow({
  gold = 0,
  materials,
  label = "Found",
  className,
}: {
  gold?: number;
  materials?: Partial<Record<MaterialId, number>>;
  label?: string;
  className?: string;
}) {
  const earnedMaterials = MATERIAL_IDS.filter((mat) => (materials?.[mat] ?? 0) > 0);
  if (gold <= 0 && earnedMaterials.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-3 text-xl font-medium text-muted-foreground",
        className,
      )}
    >
      {label}
      {gold > 0 ? <GoldPill amount={gold} /> : null}
      {earnedMaterials.map((mat) => (
        <MaterialPill key={mat} material={mat} amount={materials![mat]!} />
      ))}
    </div>
  );
}
