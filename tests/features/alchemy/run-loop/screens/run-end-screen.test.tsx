import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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

  it.each([1, 2, 3])("centers %i talent XP cards at a stable width", (count) => {
    const keywords = getTalentTreeKeywordIds().slice(0, count);
    const runEndTalentXP = Object.fromEntries(keywords.map((kw) => [kw, 1]));
    renderRunEnd({ runEndTalentXP, talentXP: runEndTalentXP });

    const row = screen.getByText(keywordDefinitions[keywords[0]!]!.label).closest(".justify-center");
    expect(row?.className).toContain("flex");
    expect(row?.children).toHaveLength(count);
    for (const card of row?.children ?? []) {
      expect(card.className).toContain("w-56");
    }
  });

  it("shows ten stable-width talent XP cards without paging", () => {
    const keywords = getTalentTreeKeywordIds().slice(0, 10);
    expect(keywords).toHaveLength(10);
    const runEndTalentXP = Object.fromEntries(keywords.map((kw) => [kw, 1]));
    renderRunEnd({ runEndTalentXP, talentXP: runEndTalentXP });

    const firstLabel = keywordDefinitions[keywords[0]!]!.label;
    const grid = screen.getByText(firstLabel).closest(".justify-center");
    expect(grid?.children).toHaveLength(10);
    expect(grid?.className).toContain("max-w-[73rem]");
    expect(grid?.firstElementChild?.className).toContain("w-56");
    expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
  });

  it("pages talent XP beginning with the eleventh type", async () => {
    const user = userEvent.setup();
    const keywords = getTalentTreeKeywordIds().slice(0, 11);
    expect(keywords).toHaveLength(11);
    const runEndTalentXP = Object.fromEntries(keywords.map((kw) => [kw, 1]));
    renderRunEnd({ runEndTalentXP, talentXP: runEndTalentXP });

    const firstTen = keywords.slice(0, 10).map((kw) => keywordDefinitions[kw]!.label);
    const eleventh = keywordDefinitions[keywords[10]!]!.label;
    for (const label of firstTen) {
      expect(screen.getByText(label).isConnected).toBe(true);
    }
    expect(screen.queryByText(eleventh)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByText(eleventh)).toBeTruthy();
    expect(screen.queryByText(firstTen[0]!)).toBeNull();
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
    expect(sizeWrapper?.className).toContain("w-[clamp(20.16cqh,20.49cqh,30.51cqh)]");
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
