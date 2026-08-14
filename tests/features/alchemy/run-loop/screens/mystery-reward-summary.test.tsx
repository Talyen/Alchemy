// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MysteryRewardSummary } from "@/features/alchemy/run-loop/screens/mystery/mystery-reward-summary";
import type { TrinketEntry } from "@/lib/game-data";
import type { MysteryChoice } from "@/lib/mystery";

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

  it("shows the chosen card tile for chooseCard", () => {
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
        chosenCardId="slash"
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByText("Slash")).toBeTruthy();
  });
});
