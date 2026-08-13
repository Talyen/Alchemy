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

function renderSummary(effects: MysteryChoice["effects"], grantedTrinketIds: string[]) {
  return render(
    <MysteryRewardSummary
      choice={{ label: "Explore the Crypt", effects }}
      runDeck={[]}
      findCard={() => undefined}
      findTrinket={(id) => (id === boneCharm.id ? boneCharm : undefined)}
      grantedTrinketIds={grantedTrinketIds}
      onContinue={vi.fn()}
      eventTitle="Overgrown Temple"
    />,
  );
}

describe("MysteryRewardSummary", () => {
  afterEach(cleanup);

  it("shows the granted trinket tile for gainRandomTrinket", () => {
    renderSummary([{ kind: "gainRandomTrinket" }], [boneCharm.id]);

    expect(screen.getByRole("img", { name: "Bone Charm" })).toBeTruthy();
    expect(screen.getByText("Bone Charm")).toBeTruthy();
    expect(screen.getByText("Added Bone Charm for this run")).toBeTruthy();
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
});
