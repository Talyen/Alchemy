import { cleanup, render, screen, waitFor } from "@testing-library/react";
import * as floatingUi from "@floating-ui/dom";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEscapeStackForTests } from "@/app/escape-stack";
import { ArmoryInventoryMenu } from "@/features/alchemy/meta/screens/armory/armory-inventory-menu";

vi.mock("@floating-ui/dom", async (importOriginal) => {
  const original = await importOriginal<typeof floatingUi>();
  return {
    ...original,
    computePosition: vi.fn(),
    autoUpdate: vi.fn((_reference: unknown, _floating: unknown, update: () => void) => {
      update();
      return () => {};
    }),
  };
});

function Harness() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <div data-testid="armory-right-panel">
      <ArmoryInventoryMenu
        label="Filters"
        open
        triggerRef={triggerRef}
        onDismiss={() => {}}
        trigger={(panelId) => (
          <button ref={triggerRef} type="button" aria-controls={panelId}>
            Filters
          </button>
        )}
      >
        <button type="button">Apply</button>
      </ArmoryInventoryMenu>
    </div>
  );
}

describe("ArmoryInventoryMenu positioning", () => {
  beforeEach(() => {
    resetEscapeStackForTests();
  });
  afterEach(() => {
    cleanup();
    resetEscapeStackForTests();
    vi.restoreAllMocks();
  });

  it("reveals the menu even when positioning rejects instead of leaving it hidden", async () => {
    vi.mocked(floatingUi.computePosition).mockRejectedValueOnce(new Error("unmounted mid-flight"));
    render(<Harness />);
    const panel = screen.getByRole("dialog", { name: "Filters" });
    await waitFor(() => expect(panel.style.visibility).toBe("visible"));
  });

  it("positions and reveals the menu when positioning succeeds", async () => {
    vi.mocked(floatingUi.computePosition).mockResolvedValue({
      x: 12,
      y: 34,
      placement: "bottom-end",
      strategy: "absolute",
      middlewareData: {},
    });
    render(<Harness />);
    const panel = screen.getByRole("dialog", { name: "Filters" });
    await waitFor(() => expect(panel.style.visibility).toBe("visible"));
    expect(panel.style.left).toBe("12px");
    expect(panel.style.top).toBe("34px");
  });
});
