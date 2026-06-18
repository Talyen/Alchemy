import { createPortal } from "react-dom";
import { getCraftingCurrencyDefinition, type CraftingCurrencyId } from "@/lib/gear";
import { cn } from "@/lib/utils";

const CURRENCY_CURSOR_STYLES: Record<CraftingCurrencyId, { className: string }> = {
  "discordant-dice": { className: "border-violet-300/70 bg-violet-950" },
  "sprig-of-growth": { className: "border-emerald-300/70 bg-emerald-950" },
  voidstone: { className: "border-slate-300/70 bg-slate-950" },
  "ascension-seal": { className: "border-amber-300/70 bg-amber-950" },
  "severance-maw": { className: "border-red-300/70 bg-red-950" },
  "smiths-whetstone": { className: "border-stone-300/70 bg-stone-950" },
};

export function ArmoryCurrencyCursor({
  activeCurrencyId,
  cursorPoint,
}: {
  activeCurrencyId: CraftingCurrencyId | null;
  cursorPoint: { x: number; y: number } | null;
}) {
  if (!activeCurrencyId || !cursorPoint) return null;
  const activeCurrency = getCraftingCurrencyDefinition(activeCurrencyId);
  return createPortal(
    <div
      data-testid="armory-crafting-cursor"
      aria-label={activeCurrency.displayName}
      className={cn(
        "pointer-events-none fixed z-[130] h-8 w-8 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded border shadow-[0_0_10px_rgba(0,0,0,0.85)]",
        CURRENCY_CURSOR_STYLES[activeCurrencyId].className,
      )}
      style={{ left: cursorPoint.x, top: cursorPoint.y }}
    >
      <img src={activeCurrency.art} alt="" className="h-full w-full object-cover" />
    </div>,
    document.body,
  );
}
