import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RunEndScreen } from "@/features/alchemy/run-loop/screens/run-end-screen";
import { getTalentTreeKeywordIds, keywordDefinitions } from "@/lib/game-data";
import type { RunObtainedItem } from "@/lib/active-run-session";
import type { GearInstance } from "@/lib/gear";
import { getGearInstanceTitle } from "@/lib/gear";

const emptyMaterials = { wood: 0, iron: 0, herbs: 0, food: 0, gems: 0 };

function gearItem(
  instanceId: string,
  definitionId = "leather-armor-basic",
): Extract<RunObtainedItem, { kind: "gear" }> {
  const instance: GearInstance = { instanceId, definitionId, affixes: [] };
  return { kind: "gear", instance };
}

function renderRunEnd({
  runEndTalentXP = {},
  talentXP = {},
  runEndMaterials = emptyMaterials,
  runEndItems = [],
}: {
  runEndTalentXP?: Record<string, number>;
  talentXP?: Record<string, number>;
  runEndMaterials?: typeof emptyMaterials;
  runEndItems?: RunObtainedItem[];
} = {}) {
  return render(
    <RunEndScreen
      title="Defeat"
      subtitle="Your run has ended."
      outcome="defeat"
      characterId="knight"
      runEndTalentXP={runEndTalentXP}
      talentXP={talentXP}
      runEndMaterials={runEndMaterials}
      runEndItems={runEndItems}
      onContinue={() => {}}
    />,
  );
}

describe("RunEndScreen", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows keyword XP earned this run with Lv# label and keyword styling", () => {
    renderRunEnd({
      runEndTalentXP: { physical: 12, burn: 3 },
      talentXP: { physical: 20, burn: 3 },
    });

    expect(screen.queryByText("+12 XP")).toBeNull();
    expect(screen.queryByText("+3 XP")).toBeNull();
    expect(screen.queryByText("8/10")).toBeNull();
    expect(screen.queryByText("0/10")).toBeNull();

    expect(screen.getByText("Physical").isConnected).toBe(true);
    expect(screen.getByText("Burn").isConnected).toBe(true);

    const physicalLv = screen
      .getAllByText(/^Lv\d+$/)
      .find((el) => el.className.includes(keywordDefinitions.physical.colorClass));
    expect(physicalLv).toBeTruthy();

    const burnLv = screen
      .getAllByText(/^Lv\d+$/)
      .find((el) => el.className.includes(keywordDefinitions.burn.colorClass));
    expect(burnLv).toBeTruthy();

    const progressBars = document.querySelectorAll(".h-1\\.5");
    expect(progressBars.length).toBeGreaterThanOrEqual(2);
  });

  it("hides keyword section when runEndTalentXP is empty", () => {
    renderRunEnd();

    expect(screen.queryByText("+12")).toBeNull();
    expect(screen.queryByText("Physical")).toBeNull();
    expect(screen.queryByText(/^Lv\d+$/)).toBeNull();
    expect(screen.getByRole("button", { name: /continue/i }).isConnected).toBe(true);
  });

  it.each([
    [1, [1]],
    [3, [3]],
    [6, [3, 3]],
    [7, [4, 3]],
    [11, [4, 4, 3]],
  ] as const)("balances %i talent XP cards into centered rows", (count, expectedRows) => {
    const keywords = getTalentTreeKeywordIds().slice(0, count);
    const runEndTalentXP = Object.fromEntries(keywords.map((kw) => [kw, 1]));
    renderRunEnd({ runEndTalentXP, talentXP: runEndTalentXP });

    const row = screen.getByText(keywordDefinitions[keywords[0]!]!.label).closest(".justify-center");
    expect(row?.className).toContain("grid");
    const cards = Array.from(row?.children ?? []) as HTMLElement[];
    expect(
      expectedRows.map((_, index) => cards.filter((card) => card.style.gridRow === String(index + 1)).length),
    ).toEqual(expectedRows);
    expect(cards.map((card) => card.textContent)).toEqual(
      keywords.map((kw) => expect.stringContaining(keywordDefinitions[kw]!.label)),
    );
    expect(row?.children).toHaveLength(count);
    for (const card of row?.children ?? []) {
      expect(card.className).toContain("w-56");
    }
  });

  it("rebalances on container resize and Game Size changes without remounting cards", () => {
    let resize = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1168);
    const computedStyle = vi
      .spyOn(window, "getComputedStyle")
      .mockReturnValue({ width: "224px" } as CSSStyleDeclaration);
    const keywords = getTalentTreeKeywordIds().slice(0, 6);
    const xp = Object.fromEntries(keywords.map((kw) => [kw, 1]));
    renderRunEnd({ runEndTalentXP: xp, talentXP: xp });
    const grid = screen.getByText(keywordDefinitions[keywords[0]!]!.label).closest(".grid")!;
    const cards = Array.from(grid.children) as HTMLElement[];
    const rows = () => cards.map((card) => card.style.gridRow);
    expect(rows()).toEqual(["1", "1", "1", "2", "2", "2"]);
    width.mockReturnValue(460);
    act(() => resize());
    expect(rows()).toEqual(["1", "1", "2", "2", "3", "3"]);
    computedStyle.mockReturnValue({ width: "268.8px" } as CSSStyleDeclaration);
    act(() => resize());
    expect(rows()).toEqual(["1", "2", "3", "4", "5", "6"]);
    width.mockReturnValue(1402);
    act(() => resize());
    expect(rows()).toEqual(["1", "1", "1", "2", "2", "2"]);
    expect(Array.from(grid.children).every((card, index) => card === cards[index])).toBe(true);
  });

  it("shows ten stable-width talent XP cards without paging", () => {
    const keywords = getTalentTreeKeywordIds().slice(0, 10);
    expect(keywords).toHaveLength(10);
    const runEndTalentXP = Object.fromEntries(keywords.map((kw) => [kw, 1]));
    renderRunEnd({ runEndTalentXP, talentXP: runEndTalentXP });

    const firstLabel = keywordDefinitions[keywords[0]!]!.label;
    const grid = screen.getByText(firstLabel).closest(".justify-center");
    expect(grid?.children).toHaveLength(10);
    expect(grid?.className).toContain("max-w-[calc(73*var(--content-rem,1rem))]");
    expect(grid?.firstElementChild?.className).toContain("w-56");
    expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
  });

  it("shows all talent categories within four five-column rows without paging", () => {
    const keywords = getTalentTreeKeywordIds();
    expect(keywords.length).toBeGreaterThan(15);
    expect(keywords.length).toBeLessThanOrEqual(20);
    const runEndTalentXP = Object.fromEntries(keywords.map((kw) => [kw, 1]));
    renderRunEnd({ runEndTalentXP, talentXP: runEndTalentXP });

    for (const kw of keywords) {
      expect(screen.getByText(keywordDefinitions[kw]!.label).isConnected).toBe(true);
    }
    expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Previous page" })).toBeNull();
  });

  it("hides obtained items when the recap is empty", () => {
    renderRunEnd();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows four obtained item portraits without paging", () => {
    const items = [0, 1, 2, 3].map((index) => gearItem(`armor-${index}`));
    renderRunEnd({ runEndItems: items });

    const portraits = screen.getAllByRole("img", { name: "Leather Armor" });
    expect(portraits).toHaveLength(4);
    const sizeWrapper = portraits[0]!.parentElement?.parentElement?.parentElement?.parentElement;
    expect(sizeWrapper?.className).toContain("w-[calc(13.8308*var(--content-rem,1rem))]");
    expect(sizeWrapper?.className).toContain("[&>*>*]:!w-full");
    expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
  });

  it("pages item portraits after four rewards", async () => {
    const user = userEvent.setup();
    const items: RunObtainedItem[] = [
      ...[0, 1, 2, 3].map((index) => gearItem(`armor-${index}`)),
      { kind: "trinket", trinketId: "bone-charm" },
    ];
    renderRunEnd({ runEndItems: items });

    expect(screen.getAllByRole("img", { name: "Leather Armor" })).toHaveLength(4);
    expect(screen.queryByRole("img", { name: "Bone Charm" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByRole("img", { name: "Bone Charm" })).toBeTruthy();
    expect(screen.queryByRole("img", { name: "Leather Armor" })).toBeNull();
  });

  it("opens only one tooltip when a saved recap contains duplicate items", async () => {
    const user = userEvent.setup();
    renderRunEnd({
      runEndItems: [
        { kind: "trinket", trinketId: "bone-charm" },
        { kind: "trinket", trinketId: "bone-charm" },
      ],
    });
    await user.hover(screen.getAllByRole("img", { name: "Bone Charm" })[0]!);
    expect(await screen.findAllByText("Bone Charm")).toHaveLength(1);
  });

  it("shows gear and trinket hover tooltips", async () => {
    const user = userEvent.setup();
    const item = gearItem("armor-tip");
    renderRunEnd({
      runEndItems: [item, { kind: "trinket", trinketId: "bone-charm" }],
    });

    const armorTitle = getGearInstanceTitle(item.instance);
    expect(screen.queryByText(armorTitle)).toBeNull();
    await user.hover(screen.getByRole("img", { name: armorTitle }));
    expect(await screen.findByText(armorTitle)).toBeTruthy();

    expect(screen.queryByText("Bone Charm")).toBeNull();
    await user.hover(screen.getByRole("img", { name: "Bone Charm" }));
    expect(await screen.findByText("Bone Charm")).toBeTruthy();
  });
});
