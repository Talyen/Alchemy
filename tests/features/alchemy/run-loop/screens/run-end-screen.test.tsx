import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RunEndScreen } from "@/features/alchemy/run-loop/screens/run-end-screen";
import { getTalentTreeKeywordIds, keywordDefinitions } from "@/lib/game-data";
import type { RunObtainedItem, RunRecap } from "@/lib/active-run-session";
import type { CraftingCurrencyId, GearInstance } from "@/lib/gear";
import { EMPTY_CRAFTING_CURRENCIES } from "@/lib/gear";
import { getGearInstanceTitle } from "@/lib/gear";

const emptyMaterials = { wood: 0, iron: 0, herbs: 0, food: 0, gems: 0, stone: 0, hide: 0 };
const emptyCurrencies: Record<CraftingCurrencyId, number> = { ...EMPTY_CRAFTING_CURRENCIES };

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
  runEndCurrencies = emptyCurrencies,
  runEndItems = [],
  runRecap = null,
  outcome = "defeat",
}: {
  runEndTalentXP?: Record<string, number>;
  talentXP?: Record<string, number>;
  runEndMaterials?: typeof emptyMaterials;
  runEndCurrencies?: Record<CraftingCurrencyId, number>;
  runEndItems?: RunObtainedItem[];
  runRecap?: RunRecap | null;
  outcome?: "victory" | "defeat";
} = {}) {
  return render(
    <RunEndScreen
      runRecap={runRecap}
      title="Journey’s End"
      subtitle=""
      outcome={outcome}
      characterId="knight"
      runEndTalentXP={runEndTalentXP}
      talentXP={talentXP}
      runEndMaterials={runEndMaterials}
      runEndCurrencies={runEndCurrencies}
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

  it("shows settled XP progress within the current talent level", async () => {
    renderRunEnd({
      runEndTalentXP: { physical: 12, burn: 3 },
      talentXP: { physical: 30, burn: 3 },
    });

    await waitFor(() => {
      expect(screen.getByRole("progressbar", { name: "Physical level 2 progress" }).getAttribute("aria-valuenow")).toBe(
        "67",
      );
      expect(screen.getByRole("progressbar", { name: "Burn level 1 progress" }).getAttribute("aria-valuenow")).toBe(
        "30",
      );
    });
  });

  it.each(["defeat", "victory"] as const)(
    "caps %s rewards and toggles all keywords in run-XP order",
    async (outcome) => {
      const user = userEvent.setup();
      const keywords = getTalentTreeKeywordIds().slice(0, 12);
      const earned = keywords.map((kw, index) => [kw, index < 2 ? 20 : index + 1] as const);
      const xp = Object.fromEntries(earned);
      const expected = [0, 1, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2].map((index) => keywords[index]!);
      renderRunEnd({
        outcome,
        runEndTalentXP: xp,
        talentXP: Object.fromEntries(keywords.map((kw, index) => [kw, 1000 - index * 10])),
      });

      const toggle = screen.getByRole("button", { name: "Show all Talent XP" });
      const controlled = document.getElementById(toggle.getAttribute("aria-controls")!)!;
      const labels = () => Array.from(controlled.querySelector(".grid")!.children).map((card) => card.textContent);
      const expectedLabels = (count: number) =>
        expected.slice(0, count).map((kw) => expect.stringContaining(keywordDefinitions[kw]!.label));
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(toggle.textContent).toBe("");
      expect(labels()).toEqual(expectedLabels(10));

      await user.click(toggle);
      expect(screen.getByRole("button", { name: "Show fewer Talent XP" })).toBe(toggle);
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      expect(document.activeElement).toBe(toggle);
      expect(labels()).toEqual(expectedLabels(12));

      await user.keyboard("{Enter}");
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(labels()).toEqual(expectedLabels(10));
      expect(document.activeElement).toBe(toggle);
    },
  );

  it.each([0, 10])("omits expansion for %i eligible keywords", (count) => {
    const keywords = getTalentTreeKeywordIds().slice(0, count);
    const xp = Object.fromEntries(keywords.map((kw) => [kw, 1]));
    renderRunEnd({ runEndTalentXP: { ...xp, exhaust: 100 }, talentXP: xp });
    expect(screen.queryByRole("button", { name: "Show all Talent XP" })).toBeNull();
    expect(screen.queryAllByRole("progressbar")).toHaveLength(count);
  });

  it.each([
    [1, [1]],
    [3, [3]],
    [6, [3, 3]],
    [7, [4, 3]],
    [10, [5, 5]],
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

  it("shows salvaged crafting currencies earned during the run", () => {
    renderRunEnd({ runEndCurrencies: { ...emptyCurrencies, "discordant-dice": 2 } });

    const chips = screen.getAllByTestId("run-end-currency");
    expect(chips).toHaveLength(1);
    expect(chips[0]!.getAttribute("data-currency-id")).toBe("discordant-dice");
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

it("shows Gold and ordinary Boon inspection without a room trail", async () => {
  const user = userEvent.setup();
  renderRunEnd({
    runRecap: {
      rooms: [
        { id: "first", destination: "Normal Combat", act: 1, floor: null, completed: false },
        { id: "later", destination: "Campfire", act: 1, floor: null, completed: true },
      ],
      mode: "campaign",
      partial: false,
      ending: "death",
      endingRoomId: "first",
      deck: [],
      boons: ["bone-charm"],
      gold: 42,
    },
  });
  expect(screen.queryByRole("region", { name: "Run journey" })).toBeNull();
  expect(screen.getByText("+42")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Inspect Boons" }));
  expect(screen.getByRole("heading", { name: "Boons" })).toBeTruthy();
  expect(screen.queryByText("Final Boons")).toBeNull();
  cleanup();
});
