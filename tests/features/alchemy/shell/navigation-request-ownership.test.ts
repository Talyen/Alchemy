import { createCleanup } from "@/lib/cleanup";
import { afterEach, expect, it, vi } from "vitest";
import { createScreenNavigation } from "@/features/alchemy/shell/screen-navigation";
import { createGameSession } from "@/features/alchemy/shared/stores/session/game-session";
import { createSessionPersistence } from "@/features/alchemy/shared/storage/session-persistence";
import {
  acceptCommand,
  dispatchRunSessionCommand,
} from "@/features/alchemy/shared/stores/commands/run-session-command";
import { setGold } from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { createSaveBackend } from "../../../helpers/save-backend";

afterEach(() => vi.useRealTimers());

it.each(["guard", "screen read", "pending notification"] as const)(
  "keeps a redirect made during %s from being replaced by the older outer request",
  async (seam) => {
    vi.useFakeTimers();
    await using session = createGameSession();
    const showScreen = vi.fn();
    const prepare = vi.fn();
    let redirected = false;
    const redirect = () => {
      if (redirected) return;
      redirected = true;
      navigation.navigateTo("armory");
    };
    const navigation = createScreenNavigation(
      {
        readScreen: () => {
          if (seam === "screen read") redirect();
          return "menu";
        },
        showScreen,
        onPendingChange: (pending) => {
          if (!pending && seam === "pending notification") redirect();
        },
      },
      session,
    );
    using _scopeCleanup = createCleanup(() => navigation.dispose());

    navigation.transition("collection", {
      guard: () => {
        if (seam === "guard") redirect();
        return true;
      },
      prepare,
    });
    vi.runAllTimers();
    expect(showScreen).toHaveBeenCalledExactlyOnceWith("armory");
    expect(prepare).not.toHaveBeenCalled();
  },
);

it("owns transition timing while its committed action waits for saving", async () => {
  vi.useFakeTimers();
  await using session = createGameSession({ saveBackend: createSaveBackend() });
  const persistence = createSessionPersistence(session);
  persistence.trackProgress(() => {});
  dispatchRunSessionCommand((tx) => acceptCommand(setGold(tx, 10)), undefined, session);
  const showScreen = vi.fn();
  const navigation = createScreenNavigation({ readScreen: () => "menu", showScreen }, session);
  const options = { prepare: () => {}, immediate: false, delayMs: 20 };
  using _scopeCleanup = createCleanup(() => navigation.dispose());

  navigation.transition("collection", options);
  options.immediate = true;
  options.delayMs = 999;
  expect(await persistence.write(persistence.snapshot())).toBe("saved");
  expect(showScreen).not.toHaveBeenCalled();
  vi.advanceTimersByTime(20);
  expect(showScreen).toHaveBeenCalledExactlyOnceWith("collection");
});

it("stops navigation safely when its pending-state observer closes the session", async () => {
  vi.useFakeTimers();
  await using session = createGameSession();
  const showScreen = vi.fn();
  const prepare = vi.fn();
  let disposal: Promise<void> | undefined;
  const navigation = createScreenNavigation(
    {
      readScreen: () => "menu",
      showScreen,
      onPendingChange: (pending) => {
        if (pending) disposal = session.dispose();
      },
    },
    session,
  );
  using _scopeCleanup = createCleanup(() => navigation.dispose());

  expect(() => navigation.navigateTo("collection", prepare)).not.toThrow();
  expect(prepare).toHaveBeenCalledOnce();
  expect(disposal).toBeDefined();
  await disposal;
  vi.runAllTimers();
  expect(showScreen).not.toHaveBeenCalled();
});
