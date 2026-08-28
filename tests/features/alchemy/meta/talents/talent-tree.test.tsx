import { StrictMode, useMemo, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TalentTree } from "@/features/alchemy/meta/talents/talent-tree";
import { TALENT_UNLOCK_ANIMATION_MS } from "@/lib/game-constants";
import { getTalentsForKeyword } from "@/lib/game-data";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";

installDisabledAnimationsForTests();

const burnTalents = getTalentsForKeyword("burn");
const first = burnTalents[0]!;
const second = burnTalents[1]!;
const third = burnTalents[2]!;

function SequentialTree({ onUnlock }: { onUnlock: (talentId: string) => void }) {
  const [unlockedIds, setUnlockedIds] = useState([first.id]);
  const allocatableIds = useMemo(() => {
    const unlocked = new Set(unlockedIds);
    return new Set([second.id, third.id].filter((id) => !unlocked.has(id)));
  }, [unlockedIds]);

  return (
    <TalentTree
      allTalents={burnTalents}
      unlockedIds={unlockedIds}
      allocatableIds={allocatableIds}
      hasUnspentPoints={unlockedIds.length < 3}
      onUnlock={(talentId) => {
        onUnlock(talentId);
        setUnlockedIds((prev) => (prev.includes(talentId) ? prev : [...prev, talentId]));
      }}
    />
  );
}

describe("TalentTree sequential unlocks", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("spends remaining points on another node without leaving the tree", () => {
    const onUnlock = vi.fn();
    render(<SequentialTree onUnlock={onUnlock} />);

    fireEvent.click(screen.getByRole("button", { name: new RegExp(second.name!) }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(third.name!) }));

    expect(onUnlock).toHaveBeenCalledWith(second.id);
    expect(onUnlock).toHaveBeenCalledWith(third.id);
    expect(onUnlock).toHaveBeenCalledTimes(2);
  });

  it("ignores a second click on the same node before the burst ends", () => {
    const onUnlock = vi.fn();
    render(<SequentialTree onUnlock={onUnlock} />);

    const secondButton = screen.getByRole("button", { name: new RegExp(second.name!) });
    fireEvent.click(secondButton);
    fireEvent.click(secondButton);

    expect(onUnlock).toHaveBeenCalledTimes(1);
    expect(onUnlock).toHaveBeenCalledWith(second.id);
  });

  it("still accepts a second unlock after the burst timeout under StrictMode", () => {
    vi.useFakeTimers();
    const onUnlock = vi.fn();
    render(
      <StrictMode>
        <SequentialTree onUnlock={onUnlock} />
      </StrictMode>,
    );

    fireEvent.click(screen.getByRole("button", { name: new RegExp(second.name!) }));
    expect(onUnlock).toHaveBeenCalledWith(second.id);

    vi.advanceTimersByTime(TALENT_UNLOCK_ANIMATION_MS);

    fireEvent.click(screen.getByRole("button", { name: new RegExp(third.name!) }));
    expect(onUnlock).toHaveBeenCalledWith(third.id);
    expect(onUnlock).toHaveBeenCalledTimes(2);
  });
});
