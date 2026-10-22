import { makeTestCard } from "../../../../fixtures/cards";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CardShopScreen } from "@/features/alchemy/run-loop/screens/card-shop-screen";
import { installReadyArtworkForTests, waitForArtwork } from "../../../../helpers/artwork-test";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";
import { installShopScreenIntersectionObserver } from "../../../../helpers/shop-screen-ui-mocks";

beforeAll(() => {
  installShopScreenIntersectionObserver();
  // JSDOM has no layout observer; the browser journey owns resize geometry.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterAll(() => vi.unstubAllGlobals());

const deckCard = makeTestCard({
  id: "strike-1",
  title: "Strike",
  descriptionLines: ["Deal 6 damage."],
  art: "strike",
});

describe("CardShopScreen remove mode", () => {
  installDisabledAnimationsForTests();
  installReadyArtworkForTests();

  afterEach(() => {
    cleanup();
  });

  function renderCardShop(
    onRemoveCard: (index: number) => boolean,
    runDeck = [deckCard],
    isProgressSavePending = () => false,
  ) {
    return render(
      <CardShopScreen
        gold={100}
        runDeck={runDeck}
        items={[deckCard]}
        refreshesLeft={1}
        removeUsed={false}
        purchasedSlotKeys={[]}
        getPrice={() => 10}
        removePrice={25}
        refreshPrice={15}
        onBuy={() => true}
        onRemoveCard={onRemoveCard}
        isProgressSavePending={isProgressSavePending}
        onRefresh={() => {}}
        onContinue={() => {}}
      />,
    );
  }

  it("disables removal when the deck is empty", async () => {
    const user = userEvent.setup();
    const onRemoveCard = vi.fn(() => true);
    renderCardShop(onRemoveCard, []);
    const remove = screen.getByRole("button", { name: /Remove Card/i });
    expect(remove).toHaveProperty("disabled", true);
    await waitForArtwork();
    await user.hover(remove.parentElement!);
    expect(await screen.findByText("No Cards to Remove")).toBeTruthy();
    expect(onRemoveCard).not.toHaveBeenCalled();
  });

  it("keeps the selected identity after rejection, blocks pending saves, and permits retry", async () => {
    const user = userEvent.setup();
    const onRemoveCard = vi.fn(() => false);
    let savePending = false;
    renderCardShop(onRemoveCard, [deckCard, { ...deckCard, id: "bash", title: "Bash" }], () => savePending);

    await user.click(screen.getByRole("button", { name: /Remove Card/i }));
    expect(await screen.findByRole("heading", { name: "Remove Card" })).toBeTruthy();

    await user.click(await screen.findByRole("button", { name: "Select Bash" }));
    await user.click(screen.getByRole("button", { name: /^Remove(?! Card)/i }));

    expect(onRemoveCard).toHaveBeenCalledExactlyOnceWith(1);
    expect(screen.getByRole("heading", { name: "Remove Card" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/could not.*remove/i);
    savePending = true;
    await user.click(screen.getByRole("button", { name: /^Remove(?! Card)/i }));
    expect(onRemoveCard).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toBeTruthy();
    savePending = false;
    onRemoveCard.mockReturnValueOnce(true);
    await user.click(screen.getByRole("button", { name: /^Remove(?! Card)/i }));
    expect(onRemoveCard).toHaveBeenNthCalledWith(2, 1);
    expect(onRemoveCard).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Remove Card" })).toBeNull();
  });
});
