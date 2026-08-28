import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderTextWithMaterials } from "@/features/alchemy/meta/screens/homestead/helpers";

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
});
