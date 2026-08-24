import { useEffect, useState } from "react";
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

/** Floating currency icon that follows the pointer over the workspace while targeting.
 * Owns its own tracking so per-move updates never re-render the armory tree above it. */
export function ArmoryCurrencyCursor({ activeCurrencyId }: { activeCurrencyId: CraftingCurrencyId | null }) {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!activeCurrencyId) return;
    function handlePointerMove(event: PointerEvent) {
      // SVG children (icons) are Element but not HTMLElement; closest() works on both.
      const target = event.target instanceof Element ? event.target : null;
      setPoint(target?.closest('[data-testid="armory-workspace"]') ? { x: event.clientX, y: event.clientY } : null);
    }
    function handlePointerOut(event: PointerEvent) {
      // pointerleave doesn't bubble, so listen for the bubbling pointerout whose
      // relatedTarget is null — the signal the pointer left the window.
      if (!event.relatedTarget) setPoint(null);
    }
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerout", handlePointerOut);
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerout", handlePointerOut);
      setPoint(null);
    };
  }, [activeCurrencyId]);

  if (!activeCurrencyId || !point) return null;
  const activeCurrency = getCraftingCurrencyDefinition(activeCurrencyId);
  return createPortal(
    <div
      data-testid="armory-crafting-cursor"
      className={cn(
        "pointer-events-none fixed z-[130] h-8 w-8 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl",
        CURRENCY_CURSOR_STYLES[activeCurrencyId].className,
      )}
      style={{ left: point.x, top: point.y }}
    >
      <img src={activeCurrency.art} alt="" className="h-full w-full object-cover" />
    </div>,
    document.body,
  );
}
