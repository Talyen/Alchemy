// Shared gold / material reward summary adopting Trinket reward wallet styling.
import { MATERIAL_IDS, type MaterialId } from "@/lib/homestead/types";
import { cn } from "@/lib/utils";

import { GoldPill, MaterialPill, TrinketWalletGrid } from "./material-icons";

export function FoundResourcesRow({
  gold = 0,
  materials,
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
    <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
      <TrinketWalletGrid hugsContent className="gap-3 px-4 py-2.5">
        {gold > 0 ? <GoldPill amount={gold} showsIncreasePrefix /> : null}
        {earnedMaterials.map((mat) => (
          <MaterialPill key={mat} material={mat} amount={materials![mat]!} showsIncreasePrefix />
        ))}
      </TrinketWalletGrid>
    </div>
  );
}
