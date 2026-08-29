import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";

import { HomesteadTileFrame } from "@/features/alchemy/meta/screens/homestead/homestead-tile-node";
import { DetailPopup } from "@/features/alchemy/shared/ui/card-popup";

function TestTile({ descriptionLines }: { descriptionLines: string[] }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  return (
    <HomesteadTileFrame
      id="test-node"
      hoveredItemId={hoveredId}
      setHoveredItemId={setHoveredId}
      detailTooltip={({ visible, triggerRef }) => (
        <DetailPopup
          idPrefix="test-node"
          title="Test Homestead Node"
          descriptionLines={visible ? descriptionLines : []}
          visible={visible}
          triggerRef={triggerRef}
        />
      )}
      surfaceClassName="w-32 aspect-[3/4]"
      imageSrc=""
      imageAlt="Test homestead tile"
      imageClassName="w-full h-full"
      footer={<div>footer</div>}
    />
  );
}

function hoverTrigger() {
  return screen.getByAltText("Test homestead tile").closest(".rounded-shell-card.p-4") as HTMLElement;
}

function panelText() {
  return document.querySelector(".hover-popup-panel")?.textContent ?? "";
}

describe("HomesteadTileFrame hover tooltip", () => {
  afterEach(cleanup);

  it("shows tooltip on mouse enter", async () => {
    render(<TestTile descriptionLines={["Gain 3 wood per run."]} />);

    fireEvent.mouseEnter(hoverTrigger());

    await waitFor(() => {
      expect(screen.getByText("Test Homestead Node")).toBeTruthy();
      expect(panelText()).toContain("Gain");
      expect(panelText()).toContain("wood");
    });
  });

  it("hides tooltip content on mouse leave", async () => {
    render(<TestTile descriptionLines={["Gain 3 wood per run."]} />);

    const trigger = hoverTrigger();
    fireEvent.mouseEnter(trigger);

    await waitFor(() => {
      expect(panelText()).toContain("wood");
    });

    fireEvent.mouseLeave(trigger);

    await waitFor(() => {
      expect(panelText()).not.toContain("wood");
    });
  });

  it("renders description content only when hovered", async () => {
    render(<TestTile descriptionLines={["Line A", "Line B"]} />);
    expect(document.querySelector(".hover-popup-panel")).toBeNull();

    fireEvent.mouseEnter(hoverTrigger());

    await waitFor(() => {
      expect(panelText()).toContain("Line A");
      expect(panelText()).toContain("Line B");
    });
  });
});
