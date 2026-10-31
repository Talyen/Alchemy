import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getCraftingCurrencyDefinition, type CraftingCurrencyId } from "@/lib/gear";

interface CursorPoint {
  x: number;
  y: number;
}

interface CursorSize {
  width: number;
  height: number;
}

function positionCursor(cursor: HTMLDivElement, point: CursorPoint, size: CursorSize): void {
  cursor.style.left = `${Math.min(point.x, window.innerWidth - size.width - 32)}px`;
  cursor.style.top = `${Math.min(point.y, window.innerHeight - size.height - 32)}px`;
}

export function ArmoryCurrencyCursor({ activeCurrencyId }: { activeCurrencyId: CraftingCurrencyId | null }) {
  const lastPoint = useRef<CursorPoint | null>(null);
  const displayedPoint = useRef<CursorPoint | null>(null);
  const activeCurrencyIdRef = useRef(activeCurrencyId);
  const cursorRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<CursorSize | null>(null);
  const [size, setSize] = useState<CursorSize | null>(null);
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    activeCurrencyIdRef.current = activeCurrencyId;
    // Selection can occur before the next movement frame. Start the new artwork
    // at the live pointer, never at the previous currency's application point.
    displayedPoint.current = activeCurrencyId ? lastPoint.current : null;
    setVisible(displayedPoint.current !== null);
  }, [activeCurrencyId]);

  useLayoutEffect(() => {
    const image = activeCurrencyId
      ? document.querySelector<HTMLImageElement>(
          `[data-testid="armory-crafting-strip"] [data-currency-id="${activeCurrencyId}"] img`,
        )
      : null;
    function measureImage() {
      const bounds = image?.getBoundingClientRect();
      const next =
        bounds && bounds.width > 0 && bounds.height > 0 ? { width: bounds.width, height: bounds.height } : null;
      sizeRef.current = next;
      setSize((previous) => (previous?.width === next?.width && previous?.height === next?.height ? previous : next));
      if (cursorRef.current && displayedPoint.current && next) {
        positionCursor(cursorRef.current, displayedPoint.current, next);
      }
    }
    // The portal is outside the scaled Armory stage. Match its actual image,
    // excluding the chip's border, before the first carried frame is painted.
    measureImage();
    if (!image) return;
    const observer = new ResizeObserver(measureImage);
    observer.observe(image);
    window.addEventListener("resize", measureImage);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measureImage);
    };
  }, [activeCurrencyId]);

  useLayoutEffect(() => {
    if (cursorRef.current && displayedPoint.current && sizeRef.current) {
      positionCursor(cursorRef.current, displayedPoint.current, sizeRef.current);
    }
  });

  useEffect(() => {
    let raf = 0;
    let pending = lastPoint.current;
    function flush() {
      raf = 0;
      const next = activeCurrencyIdRef.current ? pending : null;
      const visibilityChanged = (displayedPoint.current !== null) !== (next !== null);
      displayedPoint.current = next;
      const cursor = cursorRef.current;
      if (cursor && next && sizeRef.current) {
        // React owns mounting and artwork; pointer frames only move the
        // existing node, retaining the same CSS offsets and viewport clamp.
        positionCursor(cursor, next, sizeRef.current);
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
      if (!activeCurrencyIdRef.current) return;
      if (!raf) raf = requestAnimationFrame(flush);
    }
    function handlePointerLeave() {
      pending = null;
      lastPoint.current = pending;
      if (!activeCurrencyIdRef.current) return;
      if (!raf) raf = requestAnimationFrame(flush);
      else {
        displayedPoint.current = null;
        setVisible(false);
      }
    }
    if (activeCurrencyIdRef.current) raf = requestAnimationFrame(flush);
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
  }, []);

  if (!activeCurrencyId || !visible || !size) return null;
  const activeCurrency = getCraftingCurrencyDefinition(activeCurrencyId);
  return createPortal(
    <div
      ref={cursorRef}
      data-testid="armory-crafting-cursor"
      className="armory-currency-cursor pointer-events-none fixed z-[130] translate-x-4 translate-y-4"
      style={{ width: size.width, height: size.height }}
    >
      <img src={activeCurrency.art} alt="" decoding="async" className="h-full w-full object-cover" />
    </div>,
    document.body,
  );
}
