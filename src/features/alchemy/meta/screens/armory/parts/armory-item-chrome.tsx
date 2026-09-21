import { Lock } from "lucide-react";
import type { CraftingResult } from "../crafting-result";

export function ReservedLock() {
  return <Lock aria-hidden="true" className="absolute bottom-3 left-3 z-10 h-6 w-6 text-gold-pale" />;
}

export function CraftingFlash({ result, instanceId }: { result: CraftingResult | null; instanceId: string }) {
  if (result?.before.instanceId !== instanceId) return null;
  const flashKey = `${result.currencyId}:${result.before.affixes.map((affix) => `${affix.id}=${affix.value}`).join(";")}`;
  return (
    <span
      key={flashKey}
      aria-hidden="true"
      className="armory-item-feedback pointer-events-none absolute inset-0 z-20 rounded-shell-hero"
    />
  );
}
