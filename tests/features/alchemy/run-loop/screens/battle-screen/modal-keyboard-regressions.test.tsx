import "../../../../../helpers/mock-audio";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameMenu } from "@/features/alchemy/shared/ui/game-menu";
import { BattleBoonInspectOverlay } from "@/features/alchemy/run-loop/screens/battle-screen/boon-inspect";
import { WishOverlay } from "@/features/alchemy/run-loop/screens/battle-screen/wish-overlay";
import type { BattleActionsProps } from "@/features/alchemy/run-loop/screens/battle-screen/types";
import { cardById } from "@/lib/game-data";
import { MAX_HAND_SIZE } from "@/lib/game-constants";
import { patchBattleState } from "../../../../../fixtures/battle";
import { installReadyArtworkForTests, waitForArtwork } from "../../../../../helpers/artwork-test";
import { resetEscapeStackForTests } from "@/app/escape-stack";

installReadyArtworkForTests();
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetEscapeStackForTests();
  document.body.querySelectorAll("button:not([type])").forEach((button) => button.remove());
});
const noop = () => {};
const menuProps = {
  isOpen: true,
  onClose: noop,
  onMainMenu: noop,
  onCollection: noop,
  onTalents: noop,
  onHomestead: noop,
  onArmory: noop,
  onOptions: noop,
};

describe("keyboard access to battle and navigation modals", () => {
  it("Escape closes the pause menu above a pending Wish", async () => {
    const closeMenu = vi.fn();
    render(
      <>
        <WishOverlay
          open
          battleState={patchBattleState({ wishOptions: [cardById.slash!] })}
          actions={{ onWishChoice: noop } as unknown as BattleActionsProps}
        />
        <GameMenu {...menuProps} onClose={closeMenu} />
      </>,
    );
    await waitForArtwork();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(closeMenu).toHaveBeenCalledOnce();
  });

  it("lets the pause menu own focus above a pending Wish, then restores the Wish", async () => {
    const rect = { width: 100, height: 40 } as DOMRect;
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([rect] as unknown as DOMRectList);
    const battleState = patchBattleState({ wishOptions: [cardById.slash!, cardById.heal!] });
    const views = (paused: boolean) => (
      <>
        <WishOverlay open battleState={battleState} actions={{ onWishChoice: noop } as unknown as BattleActionsProps} />
        <GameMenu {...menuProps} isOpen={paused} />
      </>
    );
    const { rerender } = render(views(false));
    await waitForArtwork();
    const wish = screen.getByRole("dialog", { name: "Wish" });
    await waitFor(() => expect(wish.contains(document.activeElement)).toBe(true));
    const wishControl = document.activeElement;
    (wishControl as HTMLElement).scrollIntoView = vi.fn();
    rerender(views(true));
    await waitForArtwork();
    const menu = screen.getByRole("dialog", { name: "Game menu" });
    await waitFor(() => expect(menu.contains(document.activeElement)).toBe(true));
    act(() => (wishControl as HTMLElement).focus());
    expect(menu.contains(document.activeElement)).toBe(true);
    rerender(views(false));
    await waitFor(() => expect(document.activeElement).toBe(wishControl));
  });

  it.each(["Wish", "Boons", "Game menu"])("moves focus into %s and keeps Tab inside it", async (name) => {
    const rect = { width: 100, height: 40 } as DOMRect;
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([rect] as unknown as DOMRectList);
    const opener = document.createElement("button");
    opener.scrollIntoView = vi.fn();
    document.body.append(opener);
    opener.focus();
    const onChoose = vi.fn();
    const { unmount } = render(
      name === "Wish" ? (
        <WishOverlay
          open
          battleState={patchBattleState({ wishOptions: [cardById.slash!, cardById.heal!] })}
          actions={{ onWishChoice: onChoose } as unknown as BattleActionsProps}
        />
      ) : name === "Boons" ? (
        <BattleBoonInspectOverlay open trinketIds={["bone-charm"]} onClose={noop} />
      ) : (
        <GameMenu {...menuProps} />
      ),
    );
    await waitForArtwork();
    const dialog = screen.getByRole("dialog", { name });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    const controls = [...dialog.querySelectorAll<HTMLElement>("button, [tabindex='0']")];
    act(() => controls.at(-1)!.focus());
    expect(fireEvent.keyDown(controls.at(-1)!, { key: "Tab" })).toBe(false);
    expect(document.activeElement).toBe(controls[0]);
    expect(onChoose).not.toHaveBeenCalled();
    if (name === "Wish") {
      await userEvent.setup().keyboard("{Enter}");
      expect(onChoose).toHaveBeenCalledExactlyOnceWith(cardById.slash);
    }
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("explains where a Wish choice goes when the hand is full", () => {
    render(
      <WishOverlay
        open
        battleState={patchBattleState({
          hand: Array.from({ length: MAX_HAND_SIZE }, () => cardById.slash!),
          wishOptions: [cardById.heal!],
        })}
        actions={{ onWishChoice: noop } as unknown as BattleActionsProps}
      />,
    );
    expect(screen.getByText(/hand is full.*wait.*space/i)).toBeTruthy();
  });

  it("keeps a menu anchored inside a narrow viewport with room to scroll to every action", () => {
    vi.stubGlobal("innerWidth", 320);
    vi.stubGlobal("innerHeight", 240);
    render(<GameMenu {...menuProps} anchorRect={{ right: 310, bottom: 180 } as DOMRect} onEndRun={noop} />);
    const anchor = screen.getByTestId("game-menu").parentElement!;
    expect(Number.parseFloat(anchor.style.right)).toBeGreaterThanOrEqual(8);
    expect(anchor.style.maxHeight).not.toBe("");
    expect(anchor.style.overflowY).toBe("auto");
    vi.unstubAllGlobals();
  });
});
