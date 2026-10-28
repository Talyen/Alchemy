import { act, cleanup, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GearTooltipContent } from "@/features/alchemy/shared/ui/tooltips/gear-tooltip-content";
import { useGearAffixFeedback } from "@/features/alchemy/shared/ui/tooltips/gear-affix-feedback";
import {
  applyCraftingCurrency,
  gearDefinitions,
  getGearInstanceTooltipEntries,
  type GearAffixTooltipEntry,
  type GearInstance,
} from "@/lib/gear";
import { createSeededRng } from "@/lib/rng";

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

  it("reveals a changed value without replaying another affix, re-entry or another item", () => {
    const mounted = render(tooltip(after));
    expect(document.querySelector(".gear-affix-word")).toBeNull();
    const unchanged = row("flat-burn")?.querySelector(".gear-affix-line");
    mounted.rerender(tooltip({ ...after, affixes: [{ id: "flat-poison", value: 2 }, after.affixes[1]!] }));
    expect(row("flat-poison")?.getAttribute("data-affix-change")).toBe("changed");
    expect(row("flat-poison")?.textContent).toContain("2");
    expect(row("flat-burn")?.querySelector(".gear-affix-line")).toBe(unchanged);
    expect(row("flat-burn")?.querySelector(".gear-affix-word")).toBeNull();
    mounted.rerender(tooltip({ ...before, instanceId: "another-item" }));
    expect(document.querySelector("[data-affix-change]")).toBeNull();
    mounted.unmount();
    render(tooltip(after));
    expect(document.querySelector("[data-affix-change]")).toBeNull();
  });

  it.each([
    "discordant-dice",
    "sprig-of-growth",
    "severance-maw",
    "voidstone",
    "ascension-seal",
    "smiths-whetstone",
  ] as const)("presents the canonical %s outcome without changing its rolled data", (currency) => {
    const initial = currency === "sprig-of-growth" ? before : after;
    const actual = applyCraftingCurrency(currency, initial, createSeededRng(43));
    const saved = structuredClone(actual);
    const { rerender } = render(tooltip(initial));
    rerender(tooltip(actual));
    const current = getGearInstanceTooltipEntries(actual).filter((entry) => entry.affixId);
    for (const entry of current) {
      expect(row(entry.affixId!)?.textContent).toContain(String(entry.value));
      const previous = initial.affixes.find((affix) => affix.id === entry.affixId);
      expect(row(entry.affixId!)?.getAttribute("data-affix-change")).toBe(
        !previous
          ? row(entry.affixId!)?.querySelector(".gear-affix-previous")
            ? "replaced"
            : "added"
          : previous.value !== entry.value
            ? "changed"
            : null,
      );
    }
    for (const affix of initial.affixes.filter((affix) => !actual.affixes.some((next) => next.id === affix.id)))
      expect(
        row(affix.id)?.getAttribute("data-affix-change") === "removed" ||
          !!document.querySelector(`[data-previous-affix-id="${affix.id}"]`),
      ).toBe(true);
    act(() => vi.advanceTimersByTime(360));
    expect(document.querySelectorAll("[data-affix-id]")).toHaveLength(current.length);
    expect(document.querySelector("[data-affix-change]")).toBeNull();
    expect(actual).toEqual(saved);
  });

  it("replaces wording within one stable slot, without stacking a fake second affix", () => {
    const replaced: GearInstance = { ...before, affixes: [{ id: "resist-physical", value: 12 }] };
    const { rerender } = render(tooltip(before));
    const original = row("flat-poison");
    rerender(tooltip(replaced));
    const current = row("resist-physical");
    expect(current).toBe(original);
    expect(document.querySelectorAll(".gear-affix-row")).toHaveLength(1);
    expect(current?.getAttribute("data-affix-change")).toBe("replaced");
    expect(current?.querySelector(".gear-affix-previous")?.getAttribute("aria-hidden")).toBe("true");
    expect(current?.querySelector(".gear-affix-row-clip")?.classList.contains("gear-affix-replacement")).toBe(true);
    expect(current?.querySelectorAll(".gear-affix-line")).toHaveLength(2);
    act(() => vi.advanceTimersByTime(360));
    expect(row("resist-physical")).toBe(original);
    expect(current?.querySelectorAll(".gear-affix-line")).toHaveLength(1);
    expect(current?.querySelector(".gear-affix-previous")).toBeNull();
  });

  it("can add the previous affix again without reusing another row's slot", () => {
    const { rerender } = render(tooltip(before));
    rerender(tooltip({ ...before, affixes: [{ id: "flat-burn", value: 1 }] }));
    act(() => vi.advanceTimersByTime(360));
    const retained = row("flat-burn");
    rerender(tooltip(after));
    expect(row("flat-burn")).toBe(retained);
    expect(row("flat-poison")).not.toBe(retained);
    expect(document.querySelectorAll(".gear-affix-row")).toHaveLength(2);
  });
  it("does not replay identical rerolls or reorder surviving lines at completion", () => {
    const { rerender } = render(tooltip(after));
    const poison = row("flat-poison");
    const burn = row("flat-burn");
    rerender(tooltip({ ...after, affixes: [...after.affixes].reverse() }));
    expect(document.querySelector("[data-affix-change]")).toBeNull();
    expect([...document.querySelectorAll("[data-affix-id]")]).toEqual([poison, burn]);
    rerender(
      tooltip({
        ...after,
        affixes: [
          { id: "flat-burn", value: 2 },
          { id: "flat-poison", value: 1 },
        ],
      }),
    );
    act(() => vi.advanceTimersByTime(360));
    expect([...document.querySelectorAll("[data-affix-id]")]).toEqual([poison, burn]);
  });

  it("distinguishes equal displayed text by affix identity and clears interrupted replacements", () => {
    const sameText = (affixId: GearAffixTooltipEntry["affixId"]): GearAffixTooltipEntry => ({
      affixId,
      key: affixId,
      value: 1,
      name: "Same",
      text: "Same text",
    });
    const { result, rerender } = renderHook(({ entries }) => useGearAffixFeedback(entries), {
      initialProps: { entries: [sameText("flat-poison")] },
    });
    rerender({ entries: [sameText("flat-burn")] });
    expect(result.current.map((entry) => entry.change)).toEqual(["replaced"]);
    act(() => vi.advanceTimersByTime(100));
    rerender({ entries: [sameText("flat-poison")] });
    expect(result.current.map((entry) => [entry.entry.affixId, entry.change])).toEqual([["flat-poison", "replaced"]]);
    act(() => vi.advanceTimersByTime(260));
    expect(result.current.some((entry) => entry.change)).toBe(true);
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.map((entry) => [entry.entry.affixId, entry.change])).toEqual([["flat-poison", undefined]]);
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
