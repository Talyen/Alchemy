// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RunEndScreen } from "@/features/alchemy/run-loop/screens/run-end-screen";
import { getTalentTreeKeywordIds, keywordDefinitions } from "@/lib/game-data";
import type { RunObtainedItem } from "@/lib/active-run-session";
import type { GearInstance } from "@/lib/gear";
import { getGearInstanceTitle } from "@/lib/gear";

const emptyMaterials = { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 };

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
      runEndTalentXP={runEndTalentXP}
      talentXP={talentXP}
      runEndMaterials={runEndMaterials}
      runEndItems={runEndItems}
      onContinue={() => {}}
      onOpenMenu={() => {}}
    />,
  );
}

describe("RunEndScreen", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows keyword XP earned this run from runEndTalentXP snapshot", () => {
    renderRunEnd({
      runEndTalentXP: { physical: 12, burn: 3 },
      talentXP: { physical: 20, burn: 3 },
    });

    expect(screen.getByText("+12").isConnected).toBe(true);
    expect(screen.getByText("+3").isConnected).toBe(true);
    expect(screen.getByText("Physical").isConnected).toBe(true);
  });

  it("hides keyword section when runEndTalentXP is empty", () => {
    renderRunEnd();

    expect(screen.queryByText("+12")).toBeNull();
    expect(screen.queryByText("Physical")).toBeNull();
    expect(screen.getByRole("button", { name: /continue/i }).isConnected).toBe(true);
  });

  it("pages talent XP after six types", async () => {
    const user = userEvent.setup();
    const keywords = getTalentTreeKeywordIds().slice(0, 7);
    expect(keywords).toHaveLength(7);
    const runEndTalentXP = Object.fromEntries(keywords.map((kw) => [kw, 1]));
    renderRunEnd({ runEndTalentXP, talentXP: runEndTalentXP });

    const firstSix = keywords.slice(0, 6).map((kw) => keywordDefinitions[kw]!.label);
    const seventh = keywordDefinitions[keywords[6]!]!.label;
    for (const label of firstSix) {
      expect(screen.getByText(label).isConnected).toBe(true);
    }
    expect(screen.queryByText(seventh)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByText(seventh)).toBeTruthy();
    expect(screen.queryByText(firstSix[0]!)).toBeNull();
  });

  it("hides obtained items when the recap is empty", () => {
    renderRunEnd();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows four obtained item portraits without paging", () => {
    const items = [0, 1, 2, 3].map((index) => gearItem(`armor-${index}`));
    renderRunEnd({ runEndItems: items });

    expect(screen.getAllByRole("img", { name: "Leather Armor" })).toHaveLength(4);
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
