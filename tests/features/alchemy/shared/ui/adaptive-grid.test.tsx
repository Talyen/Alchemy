import { useLayoutEffect } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useAdaptiveGrid } from "@/features/alchemy/shared/ui/adaptive-grid";

function Grid({ landscape, onCapacity }: { landscape: boolean; onCapacity: (capacity: number) => void }) {
  const { onContainer, onMeasure, pageSize } = useAdaptiveGrid(landscape ? 390 : 244.512, landscape ? 3 : 4);
  useLayoutEffect(() => onCapacity(pageSize), [pageSize, onCapacity]);
  return (
    <div ref={onContainer}>
      <span ref={onMeasure} style={{ width: landscape ? 390 : 244.512 }} />
      <output>{pageSize}</output>
    </div>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("uses the new tile width immediately when switching between portrait and landscape tabs", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1400);
  const onCapacity = vi.fn();
  const { rerender } = render(<Grid landscape={false} onCapacity={onCapacity} />);
  expect(screen.getByRole("status").textContent).toBe("10");
  onCapacity.mockClear();
  rerender(<Grid landscape onCapacity={onCapacity} />);
  expect(screen.getByRole("status").textContent).toBe("6");
  expect(onCapacity.mock.calls).toEqual([[6]]);
  onCapacity.mockClear();
  rerender(<Grid landscape={false} onCapacity={onCapacity} />);
  expect(screen.getByRole("status").textContent).toBe("10");
  expect(onCapacity.mock.calls).toEqual([[10]]);
});
