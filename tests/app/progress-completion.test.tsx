import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GenericShopScreen } from "@/features/alchemy/run-loop/screens/generic-shop-screen";
import { defaultGameSession } from "@/app/application-session";
import { SaveWriteNotice } from "@/app/save-write-notice";
import { createAlchemyAutosaveLifecycle } from "@/app/autosave-lifecycle";
import { createSessionPersistence } from "@/features/alchemy/shared/storage";
import { useGameplayStateStore } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { guardProgressAction } from "@/features/alchemy/shared/stores/session-capabilities";

const persistence = createSessionPersistence(defaultGameSession);
afterEach(async () => {
  cleanup();
  await persistence.resetForTests();
  vi.restoreAllMocks();
});

it("shows pending acknowledgement, retains displayed progress on failure, and Retry completes the original action once", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  let fail = true;
  let writes = 0;
  persistence.configure({
    readCandidates: async () => ({ ok: true, candidates: [] }),
    write: async () => {
      writes++;
      return fail ? { ok: false, error: "disk full" } : { ok: true };
    },
    writeSync: () => null,
    clear: async () => ({ ok: true }),
  });
  dispatchRunSessionCommand((draft) => acceptCommand(setGold(draft, 100)), undefined, defaultGameSession);
  const lifecycle = createAlchemyAutosaveLifecycle(() => true, undefined, defaultGameSession, true);
  const spend = vi.fn(() => {
    dispatchRunSessionCommand((draft) => acceptCommand(setGold(draft, 90)), undefined, defaultGameSession);
    return true;
  });
  function Purchase() {
    const gold = useGameplayStateStore((state) => state.runProfile.gold);
    return (
      <>
        <output aria-label="Gold">{gold}</output>
        <GenericShopScreen
          title="Card Shop"
          gold={gold}
          items={[1]}
          refreshesLeft={0}
          refreshPrice={0}
          purchasedSlotKeys={[]}
          getSlotKey={String}
          getPrice={() => 10}
          onBuy={guardProgressAction(defaultGameSession, spend, false)}
          onRefresh={() => {}}
          onContinue={() => {}}
          isProgressSavePending={() => persistence.readProgress().kind !== "idle"}
          renderItem={(_item, _price, _purchased, onBuy) => <button onClick={onBuy}>Buy</button>}
        />
        <SaveWriteNotice />
      </>
    );
  }
  try {
    render(<Purchase />);
    fireEvent.click(screen.getByRole("button", { name: "Buy" }));
    expect(screen.getByText("Saving…").textContent).toContain("Saving…");
    expect(screen.getByLabelText("Gold").textContent).toBe("100");
    await act(async () => {
      await lifecycle.drain();
    });
    expect(screen.getByRole("alert").textContent).toContain("Couldn’t save");
    fireEvent.click(screen.getByRole("button", { name: "Buy" }));
    expect(spend).toHaveBeenCalledOnce();
    expect(screen.queryByText(/Could not complete this purchase/)).toBeNull();
    fail = false;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      await lifecycle.drain();
    });
    expect(writes).toBeGreaterThanOrEqual(3);
    expect(spend).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Gold").textContent).toBe("90");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Saving…")).toBeNull();
  } finally {
    lifecycle.dispose(false);
  }
});
