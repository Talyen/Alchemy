import { createPortal } from "react-dom";
import { getCraftingCurrencyDefinition, type CraftingCurrencyId } from "@/lib/gear";
import { cn } from "@/lib/utils";

const CURRENCY_CURSOR_STYLES: Record<CraftingCurrencyId, { className: string }> = {
  "discordant-dice": { className: "bg-violet-950" },
  "sprig-of-growth": { className: "bg-emerald-950" },
  voidstone: { className: "bg-slate-950" },
  "ascension-seal": { className: "bg-amber-950" },
  "severance-maw": { className: "bg-red-950" },
  "smiths-whetstone": { className: "bg-stone-950" },
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
        "pointer-events-none fixed z-[130] h-8 w-8 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl",
        CURRENCY_CURSOR_STYLES[activeCurrencyId].className,
      )}
      style={{ left: cursorPoint.x, top: cursorPoint.y }}
    >
      <img src={activeCurrency.art} alt="" className="h-full w-full object-cover" />
    </div>,
    document.body,
  );
}
