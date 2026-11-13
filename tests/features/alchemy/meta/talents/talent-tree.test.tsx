import { StrictMode, useMemo, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TalentTree } from "@/features/alchemy/meta/talents/talent-tree";
import { TALENT_NODE_UNLOCK_MS } from "@/features/alchemy/meta/talents/talent-node-face";
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

  it.each([0, TALENT_NODE_UNLOCK_MS])("accepts consecutive unlocks under StrictMode after %i ms", (delay) => {
    vi.useFakeTimers();
    const onUnlock = vi.fn();
    render(
      <StrictMode>
        <SequentialTree onUnlock={onUnlock} />
      </StrictMode>,
    );

    fireEvent.click(screen.getByRole("button", { name: new RegExp(second.name!) }));
    expect(onUnlock).toHaveBeenCalledWith(second.id);

    vi.advanceTimersByTime(delay);

    fireEvent.click(screen.getByRole("button", { name: new RegExp(third.name!) }));
    expect(onUnlock).toHaveBeenCalledWith(third.id);
    expect(onUnlock).toHaveBeenCalledTimes(2);
  });

  it("exposes unlocked, available and locked allocation states", () => {
    render(
      <TalentTree
        allTalents={[first, second, third]}
        unlockedIds={[first.id]}
        allocatableIds={new Set([second.id])}
        hasUnspentPoints
        onUnlock={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: new RegExp(`Unlocked.*${first.name}`) }).getAttribute("aria-disabled"),
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: new RegExp(`Available to unlock.*${second.name}`) })
        .getAttribute("aria-disabled"),
    ).toBe("false");
    expect(
      screen.getByRole("button", { name: new RegExp(`Locked.*${third.name}`) }).getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it.each(["{Enter}", " "])("retains focus and prevents another purchase with %s", async (key) => {
    const user = userEvent.setup();
    const onUnlock = vi.fn();
    render(<SequentialTree onUnlock={onUnlock} />);
    const button = screen.getByRole("button", { name: new RegExp(second.name!) });
    act(() => button.focus());
    await user.keyboard(key);
    expect(document.activeElement).toBe(button);
    expect(screen.getByRole("button", { name: new RegExp(second.name!) })).toBe(button);
    await user.keyboard(key);
    expect(onUnlock).toHaveBeenCalledExactlyOnceWith(second.id);
  });
});
