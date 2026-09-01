import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  HOMESTEAD_CONFIG,
  getArt,
  getItems,
  renderTextWithMaterials,
} from "@/features/alchemy/meta/screens/homestead/helpers";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";

describe("renderTextWithMaterials", () => {
  it("renders inline material chips with proper compact size, margin, and middle alignment", () => {
    render(<div>{renderTextWithMaterials("Produces 5 Wood and 2 Iron each turn.")}</div>);

    const woodText = screen.getByText("Wood");
    expect(woodText).toBeTruthy();
    expect(woodText.classList.contains("leading-none")).toBe(true);

    const woodChip = woodText.parentElement;
    expect(woodChip).toBeTruthy();
    expect(woodChip?.classList.contains("inline-flex")).toBe(true);
    expect(woodChip?.classList.contains("text-xs")).toBe(true);
    expect(woodChip?.classList.contains("mx-1")).toBe(true);
    expect(woodChip?.classList.contains("align-middle")).toBe(true);
    expect(woodChip?.classList.contains("leading-none")).toBe(true);

    const ironText = screen.getByText("Iron");
    expect(ironText).toBeTruthy();
    const ironChip = ironText.parentElement;
    expect(ironChip?.classList.contains("mx-1")).toBe(true);
    expect(ironChip?.classList.contains("text-xs")).toBe(true);
  });

  it("renders multiple chips in one line and plain text segments", () => {
    const { container } = render(<div>{renderTextWithMaterials("Gain 2 Food and 1 Herbs each run")}</div>);
    expect(screen.getByText("Food")).toBeTruthy();
    expect(screen.getByText("Herbs")).toBeTruthy();
    expect(container.textContent).toContain("Gain");
  });

  it("returns plain text when no material is present", () => {
    const { container } = render(<div>{renderTextWithMaterials("No materials here")}</div>);
    expect(container.textContent).toContain("No materials here");
  });
});

describe("getArt", () => {
  it("returns a string for known ids", () => {
    expect(getArt("blacksmiths-forge")).toBeTruthy();
    expect(typeof getArt("blacksmiths-forge")).toBe("string");
  });

  it("returns fallback empty for unknown id", () => {
    expect(getArt("unknown-id")).toBe("");
  });
});

describe("getItems", () => {
  it("maps buildings pool to GoalItem with building kind", () => {
    const items = getItems("buildings", buildings);
    expect(items).toHaveLength(buildings.length);
    expect(items[0]?.kind).toBe("building");
  });

  it("maps farm pool to GoalItem with farm kind", () => {
    const items = getItems("farm", farmPlots);
    expect(items.every((i) => i.kind === "farm")).toBe(true);
  });

  it("maps research pool to GoalItem with research kind", () => {
    const items = getItems("research", researchUpgrades);
    expect(items.every((i) => i.kind === "research")).toBe(true);
  });
});

describe("HOMESTEAD_CONFIG", () => {
  it("has expected pagination and aspect constants", () => {
    expect(HOMESTEAD_CONFIG.companionPageSize).toBe(4);
    expect(HOMESTEAD_CONFIG.artAspectRatio).toContain("aspect");
    expect(HOMESTEAD_CONFIG.companionAspectRatio).toContain("aspect");
  });
});
