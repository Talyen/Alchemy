import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GearTooltipContent } from "@/features/alchemy/shared/ui/tooltips/gear-tooltip-content";
import { gearDefinitions, type GearInstance } from "@/lib/gear";

const before: GearInstance = {
  instanceId: "craft-test",
  definitionId: "emerald-amulet-basic",
  affixes: [{ id: "flat-poison", value: 1 }],
};
const after: GearInstance = { ...before, affixes: [...before.affixes, { id: "flat-burn", value: 1 }] };
const tooltip = (instance: GearInstance) => (
  <GearTooltipContent definition={gearDefinitions[instance.definitionId]!} instance={instance} />
);
const row = (id: string) => document.querySelector(`[data-affix-id="${id}"]`);

describe("Crafted affix inspection feedback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.removeItem("alchemy-disable-animations");
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    localStorage.removeItem("alchemy-disable-animations");
    vi.unstubAllGlobals();
  });

  it("reveals only the added words, preserving keyword color and existing row identity", () => {
    const { rerender } = render(tooltip(before));
    const existing = row("flat-poison");
    rerender(tooltip(after));
    expect(row("flat-poison")).toBe(existing);
    expect(existing?.querySelector(".gear-affix-word")).toBeNull();
    expect(row("flat-burn")?.getAttribute("data-affix-change")).toBe("added");
    expect(row("flat-burn")?.querySelectorAll(".gear-affix-word").length).toBeGreaterThan(1);
    const burnWord = [...row("flat-burn")!.querySelectorAll(".gear-affix-word")].find(
      (node) => node.textContent === "Burn",
    );
    expect(burnWord?.parentElement?.className).toContain("font-semibold");
    expect(burnWord?.parentElement?.className).toContain("text-");
    act(() => vi.advanceTimersByTime(360));
    expect(row("flat-burn")?.hasAttribute("data-affix-change")).toBe(false);
  });

  it("retains a removed line only for its exit, including removing the last affix", () => {
    const { rerender } = render(tooltip(before));
    rerender(tooltip({ ...before, affixes: [] }));
    expect(row("flat-poison")?.getAttribute("aria-hidden")).toBe("true");
    act(() => vi.advanceTimersByTime(359));
    expect(row("flat-poison")).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(row("flat-poison")).toBeNull();
  });

  it("does not replay old additions on re-entry, other items or value-only changes", () => {
    const mounted = render(tooltip(after));
    expect(document.querySelector(".gear-affix-word")).toBeNull();
    mounted.rerender(tooltip({ ...after, affixes: [{ id: "flat-poison", value: 2 }, after.affixes[1]!] }));
    expect(document.querySelector(".gear-affix-word")).toBeNull();
    mounted.rerender(tooltip({ ...before, instanceId: "another-item" }));
    expect(document.querySelector("[data-affix-change]")).toBeNull();
    mounted.unmount();
    render(tooltip(after));
    expect(document.querySelector("[data-affix-change]")).toBeNull();
  });

  it("supersedes an interrupted craft without stale removals or timer completion", () => {
    const { rerender } = render(tooltip(after));
    rerender(tooltip(before));
    act(() => vi.advanceTimersByTime(100));
    rerender(tooltip(after));
    expect(row("flat-burn")?.getAttribute("data-affix-change")).toBe("added");
    act(() => vi.advanceTimersByTime(260));
    expect(row("flat-burn")?.getAttribute("data-affix-change")).toBe("added");
    act(() => vi.advanceTimersByTime(100));
    expect(row("flat-burn")).not.toBeNull();
    expect(document.querySelector("[data-affix-change]")).toBeNull();
  });

  it.each(["disabled", "reduced"])("shows the immediate canonical result when motion is %s", (preference) => {
    if (preference === "disabled") localStorage.setItem("alchemy-disable-animations", "true");
    else
      vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const { rerender } = render(tooltip(before));
    rerender(tooltip(after));
    expect(row("flat-burn")).not.toBeNull();
    expect(document.querySelector("[data-affix-change]")).toBeNull();
    rerender(tooltip(before));
    expect(row("flat-burn")).toBeNull();
  });

  it("keeps unique effects that are defined without rolled affixes", () => {
    render(tooltip({ instanceId: "solstice", definitionId: "twin-casting", affixes: [] }));
    expect(document.body.textContent).toContain("Solstice");
    expect(document.body.textContent?.length).toBeGreaterThan(20);
  });
});
