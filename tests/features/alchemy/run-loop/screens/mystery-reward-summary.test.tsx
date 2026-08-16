// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MysteryRewardSummary } from "@/features/alchemy/run-loop/screens/mystery/mystery-reward-summary";
import type { TrinketEntry } from "@/lib/game-data";
import type { MysteryChoice } from "@/lib/mystery";
import { getGearInstanceTitle } from "@/lib/gear";

const boneCharm: TrinketEntry = {
  id: "bone-charm",
  title: "Bone Charm",
  descriptionLines: ["Enemies you defeat drop Gold."],
  art: "bone-charm-art",
};

function renderSummary(
  effects: MysteryChoice["effects"],
  grantedTrinketIds: string[],
  chosenCardId: string | null = null,
) {
  return render(
    <MysteryRewardSummary
      choice={{ label: "Explore the Crypt", effects }}
      findCard={() => undefined}
      findTrinket={(id) => (id === boneCharm.id ? boneCharm : undefined)}
      grantedTrinketIds={grantedTrinketIds}
      grantedGearInstances={[]}
      chosenCardId={chosenCardId}
      onContinue={vi.fn()}
    />,
  );
}

describe("MysteryRewardSummary", () => {
  afterEach(cleanup);

  it("shows the granted trinket tile for gainRandomTrinket", () => {
    renderSummary([{ kind: "gainRandomTrinket" }], [boneCharm.id]);

    expect(screen.getByRole("img", { name: "Bone Charm" })).toBeTruthy();
    expect(screen.getByText("Bone Charm")).toBeTruthy();
    expect(screen.queryByText("Gained a random trinket for this run")).toBeNull();
  });

  it("shows the trinket hover tooltip for gainRandomTrinket", () => {
    renderSummary([{ kind: "gainRandomTrinket" }], [boneCharm.id]);

    const img = screen.getByRole("img", { name: "Bone Charm" });
    const tileWrapper = img.parentElement?.parentElement;
    expect(tileWrapper).toBeTruthy();
    expect(screen.getAllByText("Bone Charm")).toHaveLength(1);

    fireEvent.mouseEnter(tileWrapper!);

    // The hover DetailPopup mounts with a second copy of the trinket title.
    expect(screen.getAllByText("Bone Charm")).toHaveLength(2);
  });

  it("falls back to random trinket text when the granted id is unavailable", () => {
    renderSummary([{ kind: "gainRandomTrinket" }], []);

    expect(screen.getByText("Gained a random trinket for this run")).toBeTruthy();
    expect(screen.queryByText("Bone Charm")).toBeNull();
  });

  it("shows the chosen card tile and hover popup for chooseCard", () => {
    const slash = {
      id: "slash",
      title: "Slash",
      descriptionLines: ["Deal 6 damage."],
      art: "slash-art",
      cost: 1,
      effects: [],
    };
    render(
      <MysteryRewardSummary
        choice={{ label: "Browse", effects: [{ kind: "chooseCard" }] }}
        findCard={(id) => (id === slash.id ? slash : undefined)}
        findTrinket={() => undefined}
        grantedTrinketIds={[]}
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

  it("renders KeywordProgressCard for gainXP effects and triggers onContinue on click", () => {
    const onContinue = vi.fn();
    render(
      <MysteryRewardSummary
        choice={{ label: "Practice Alchemy", effects: [{ kind: "gainXP", keyword: "burn", amount: 8 }] }}
        findCard={() => undefined}
        findTrinket={() => undefined}
        grantedTrinketIds={[]}
        grantedGearInstances={[]}
        chosenCardId={null}
        runTalentXP={{ burn: 8 }}
        talentXP={{ burn: 10 }}
        onContinue={onContinue}
      />,
    );

    expect(screen.getByText("Burn")).toBeTruthy();
    expect(screen.getByText("+8")).toBeTruthy();

    const continueBtn = screen.getByRole("button", { name: "Continue" });
    expect(continueBtn).toBeTruthy();
    fireEvent.click(continueBtn);
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("renders multiple XP rewards grouped by keyword", () => {
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
        grantedTrinketIds={[]}
        grantedGearInstances={[]}
        chosenCardId={null}
        runTalentXP={{ burn: 8, freeze: 6 }}
        talentXP={{ burn: 0, freeze: 0 }}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByText("Burn")).toBeTruthy();
    expect(screen.getByText("+8")).toBeTruthy();
    expect(screen.getByText("Freeze")).toBeTruthy();
    expect(screen.getByText("+6")).toBeTruthy();
  });

  it("shows the granted gear tile for gainGeneratedGear", () => {
    const instance = { instanceId: "mystery-gear-1", definitionId: "emerald-ring-basic", affixes: [] };
    render(
      <MysteryRewardSummary
        choice={{ label: "Harvest Mushrooms", effects: [{ kind: "gainGeneratedGear", baseItemId: "emerald-ring" }] }}
        findCard={() => undefined}
        findTrinket={() => undefined}
        grantedTrinketIds={[]}
        grantedGearInstances={[instance]}
        chosenCardId={null}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByText(getGearInstanceTitle(instance))).toBeTruthy();
    const basicSurface = screen.getByRole("img", { name: getGearInstanceTitle(instance) }).closest(".tilt-surface");
    expect(basicSurface?.querySelector(".shine-border")).toBeNull();
    expect(basicSurface?.className).toMatch(/card-interactive-glow/);
  });

  it("shows a shine border on astral granted gear without hover chrome", () => {
    const instance = { instanceId: "mystery-gear-astral", definitionId: "emerald-ring-astral", affixes: [] };
    render(
      <MysteryRewardSummary
        choice={{ label: "Harvest Mushrooms", effects: [{ kind: "gainGeneratedGear", baseItemId: "emerald-ring" }] }}
        findCard={() => undefined}
        findTrinket={() => undefined}
        grantedTrinketIds={[]}
        grantedGearInstances={[instance]}
        chosenCardId={null}
        onContinue={vi.fn()}
      />,
    );

    const surface = screen.getByRole("img", { name: getGearInstanceTitle(instance) }).closest(".tilt-surface");
    expect(surface?.querySelector(".shine-border")).not.toBeNull();
    expect(surface?.className).toMatch(/card-interactive-glow/);
    expect(surface?.className).toMatch(/has-shine-border/);
  });
});
