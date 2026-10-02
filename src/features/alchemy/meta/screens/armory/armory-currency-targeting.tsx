import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

interface CursorPoint {
  x: number;
  y: number;
}

function positionCursor(cursor: HTMLDivElement, point: CursorPoint): void {
  cursor.style.left = `${Math.min(point.x, window.innerWidth - 112)}px`;
  cursor.style.top = `${Math.min(point.y, window.innerHeight - 112)}px`;
}

export function ArmoryCurrencyCursor({ activeCurrencyId }: { activeCurrencyId: CraftingCurrencyId | null }) {
  const lastPoint = useRef<CursorPoint | null>(null);
  const displayedPoint = useRef<CursorPoint | null>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    if (cursorRef.current && displayedPoint.current) positionCursor(cursorRef.current, displayedPoint.current);
  });

  useEffect(() => {
    if (!activeCurrencyId) {
      return;
    }
    let raf = 0;
    let pending = lastPoint.current;
    function flush() {
      raf = 0;
      const next = pending;
      const visibilityChanged = (displayedPoint.current !== null) !== (next !== null);
      displayedPoint.current = next;
      const cursor = cursorRef.current;
      if (cursor && next) {
        // React owns mounting and artwork; pointer frames only move the
        // existing node, retaining the same CSS offsets and viewport clamp.
        positionCursor(cursor, next);
      }
      if (visibilityChanged) setVisible(next !== null);
    }
    function handlePointerMove(event: PointerEvent) {
      const target = event.target instanceof Element ? event.target : null;
      pending =
        event.pointerType !== "touch" && target?.closest('[data-testid="armory-workspace"]')
          ? { x: event.clientX, y: event.clientY }
          : null;
      lastPoint.current = pending;
      if (!raf) raf = requestAnimationFrame(flush);
    }
    function handlePointerLeave() {
      pending = null;
      lastPoint.current = pending;
      if (!raf) raf = requestAnimationFrame(flush);
      else {
        displayedPoint.current = null;
        setVisible(false);
      }
    }
    raf = requestAnimationFrame(flush);
    document.addEventListener("pointerdown", handlePointerMove, { passive: true });
    document.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", handlePointerLeave);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("pointerdown", handlePointerMove);
      document.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener("pointerleave", handlePointerLeave);
      displayedPoint.current = null;
      setVisible(false);
    };
  }, [activeCurrencyId]);

  if (!activeCurrencyId || !visible) return null;
  const activeCurrency = getCraftingCurrencyDefinition(activeCurrencyId);
  return createPortal(
    <div
      ref={cursorRef}
      data-testid="armory-crafting-cursor"
      className={cn(
        "armory-currency-cursor pointer-events-none fixed z-[130] translate-x-4 translate-y-4 overflow-hidden rounded-xl",
        CURRENCY_CURSOR_STYLES[activeCurrencyId].className,
      )}
    >
      <img src={activeCurrency.art} alt="" className="h-full w-full object-cover" />
    </div>,
    document.body,
  );
}
