import { makeTestCard } from "../../../../fixtures/cards";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MysteryRewardSummary } from "@/features/alchemy/run-loop/screens/mystery/mystery-reward-summary";
import { type TrinketEntry } from "@/lib/game-data";
import type { MysteryChoice } from "@/lib/mystery";
import { getGearInstanceTitle, type GearInstance } from "@/lib/gear";

const boneCharm: TrinketEntry = {
  id: "bone-charm",
  title: "Bone Charm",
  descriptionLines: ["Enemies you defeat drop Gold."],
  art: "bone-charm-art",
  effects: {},
};

function renderSummary(
  effects: MysteryChoice["effects"],
  grantedGearInstances: GearInstance[] = [],
  chosenCardId: string | null = null,
) {
  return render(
    <MysteryRewardSummary
      choice={{ label: "Explore the Crypt", effects }}
      findCard={() => undefined}
      findTrinket={(id) => (id === boneCharm.id ? boneCharm : undefined)}
      grantedGearInstances={grantedGearInstances}
      chosenCardId={chosenCardId}
      onContinue={vi.fn()}
    />,
  );
}

describe("MysteryRewardSummary", () => {
  afterEach(cleanup);

  it("shows mixed Boon and Gear grants in effect order with their correct titles", () => {
    const generated: GearInstance = { instanceId: "generated", definitionId: "emerald-ring-basic", affixes: [] };
    const random: GearInstance = { instanceId: "random", definitionId: "leather-armor-basic", affixes: [] };
    renderSummary(
      [
        { kind: "gainTrinket", trinketId: boneCharm.id },
        { kind: "gainGeneratedGear", baseItemId: "emerald-ring" },
        { kind: "gainRandomGear" },
      ],
      [generated, random],
    );
    expect(screen.getAllByRole("img").map((image) => image.getAttribute("alt"))).toEqual([
      boneCharm.title,
      getGearInstanceTitle(generated),
      getGearInstanceTitle(random),
    ]);
    expect(screen.getByText(getGearInstanceTitle(generated))).toBeTruthy();
    expect(screen.getByText(getGearInstanceTitle(random))).toBeTruthy();
  });

  it("shows the chosen card tile and hover popup for chooseCard", () => {
    const slash = makeTestCard({
      id: "slash",
      title: "Slash",
      descriptionLines: ["Deal 6 damage."],
      art: "slash-art",
    });
    render(
      <MysteryRewardSummary
        choice={{ label: "Browse", effects: [{ kind: "chooseCard" }] }}
        findCard={(id) => (id === slash.id ? slash : undefined)}
        findTrinket={() => undefined}
        grantedGearInstances={[]}
        chosenCardId="slash"
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByText("Slash")).toBeTruthy();

    const img = screen.getByRole("img", { name: "Slash" });
    const tileWrapper = img.parentElement?.parentElement;
    expect(tileWrapper).toBeTruthy();

    fireEvent.mouseEnter(tileWrapper!);
    expect(screen.getByText(/damage/)).toBeTruthy();
  });

  it("combines prior and run XP when showing progress after leveling up", async () => {
    const onContinue = vi.fn();
    render(
      <MysteryRewardSummary
        choice={{
          label: "Study the Elements",
          effects: [
            { kind: "gainXP", keyword: "burn", amount: 4 },
            { kind: "gainXP", keyword: "burn", amount: 4 },
            { kind: "gainXP", keyword: "freeze", amount: 6 },
          ],
        }}
        findCard={() => undefined}
        findTrinket={() => undefined}
        grantedGearInstances={[]}
        chosenCardId={null}
        runTalentXP={{ burn: 18, freeze: 6 }}
        talentXP={{ burn: 30, freeze: 14 }}
        onContinue={onContinue}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole("progressbar", { name: "Burn level 2 progress" }).getAttribute("aria-valuenow")).toBe(
        "70",
      ),
    );
    expect(screen.getByRole("progressbar", { name: "Freeze level 2 progress" }).getAttribute("aria-valuenow")).toBe(
      "0",
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
