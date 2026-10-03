import { useLayoutEffect, useState } from "react";
import { MATERIAL_IDS, type MaterialId } from "@/lib/homestead/types";
import { cn } from "@/lib/utils";

import { ResourcePill } from "./material-icons";

function balancedRowSizes(widths: number[], availableWidth: number, gap: number): number[] {
  for (let rowCount = 1; rowCount <= widths.length; rowCount++) {
    const small = Math.floor(widths.length / rowCount);
    const largeCount = widths.length % rowCount;
    const fit = (offset: number, rowsLeft: number, largeLeft: number): number[] | null => {
      if (rowsLeft === 0) return [];
      // Try the larger rows first, but allow a smaller first row when widths require it.
      const sizes = largeLeft > 0 ? [small + 1, small] : [small];
      for (const count of sizes) {
        if (count === small && rowsLeft === largeLeft) continue;
        const width = widths.slice(offset, offset + count).reduce((sum, value) => sum + value, 0);
        if (count > 1 && width + gap * (count - 1) > availableWidth + 0.5) continue;
        const remaining = fit(offset + count, rowsLeft - 1, largeLeft - Number(count > small));
        if (remaining) return [count, ...remaining];
      }
      return null;
    };
    const sizes = fit(0, rowCount, largeCount);
    if (sizes) return sizes;
  }
  return [];
}

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
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [rowSizes, setRowSizes] = useState<number[]>([]);
  const earnedMaterials = MATERIAL_IDS.filter((mat) => (materials?.[mat] ?? 0) > 0);
  const resources = [
    ...(gold > 0 ? [{ resource: "gold" as const, amount: gold }] : []),
    ...earnedMaterials.map((resource) => ({ resource, amount: materials?.[resource] ?? 0 })),
  ];

  useLayoutEffect(() => {
    if (!container || typeof ResizeObserver === "undefined") return;
    const pills = Array.from(container.querySelectorAll<HTMLElement>("[data-reward-resource]"));
    const update = () => {
      if (container.clientWidth <= 0 || pills.length === 0) return;
      // Layout widths exclude the stage transform; measuring every pill preserves natural sizing.
      const widths = pills.map((pill) => parseFloat(getComputedStyle(pill).width));
      if (widths.some((width) => !(width > 0))) return;
      const gap = parseFloat(getComputedStyle(pills[0]!.parentElement!).columnGap) || 0;
      const next = balancedRowSizes(widths, container.clientWidth, gap);
      setRowSizes((previous) =>
        previous.length === next.length && previous.every((count, index) => count === next[index]) ? previous : next,
      );
    };
    update();
    let frame: number | null = null;
    const observer = new ResizeObserver(() => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = null;
        update();
      });
    });
    observer.observe(container);
    for (const pill of pills) observer.observe(pill);
    observer.observe(pills[0]!.parentElement!);
    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [container, gold, materials, size, rowSizes]);

  if (resources.length === 0) return null;
  const sizes = rowSizes.reduce((sum, count) => sum + count, 0) === resources.length ? rowSizes : [resources.length];

  return (
    <div ref={setContainer} className={cn("flex w-full min-w-0 flex-col items-center gap-3", className)}>
      {sizes.map((count, rowIndex) => {
        const offset = sizes.slice(0, rowIndex).reduce((sum, size) => sum + size, 0);
        const row = resources.slice(offset, offset + count);
        return (
          <div key={rowIndex} className="flex w-full flex-wrap items-center justify-center gap-3">
            {row.map(({ resource, amount }) => (
              <div key={resource} data-reward-resource={resource} className="w-max shrink-0">
                <ResourcePill
                  resource={resource}
                  amount={amount}
                  showsIncreasePrefix
                  fillsAvailableWidth={false}
                  size={size}
                />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
