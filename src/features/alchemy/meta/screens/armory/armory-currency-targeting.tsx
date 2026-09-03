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

export function ArmoryCurrencyCursor({ activeCurrencyId }: { activeCurrencyId: CraftingCurrencyId | null }) {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!activeCurrencyId) return;
    let raf = 0;
    let pending: { x: number; y: number } | null = null;
    function flush() {
      raf = 0;
      setPoint(pending);
    }
    function handlePointerMove(event: PointerEvent) {
      const target = event.target instanceof Element ? event.target : null;
      pending = target?.closest('[data-testid="armory-workspace"]') ? { x: event.clientX, y: event.clientY } : null;
      if (!raf) raf = requestAnimationFrame(flush);
    }
    function handlePointerLeave() {
      pending = null;
      if (!raf) raf = requestAnimationFrame(flush);
      else setPoint(null);
    }
    document.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", handlePointerLeave);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener("pointerleave", handlePointerLeave);
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
