import { createSaveBackend } from "../../../../helpers/save-backend";
import { afterEach, expect, it, vi } from "vitest";
import { createAlchemyAutosaveLifecycle } from "@/app/autosave-lifecycle";
import { createGameSession } from "@/features/alchemy/shared/stores/session/game-session";
import {
  acceptCommand,
  dispatchRunSessionCommand,
} from "@/features/alchemy/shared/stores/commands/run-session-command";
import { guardProgressAction } from "@/features/alchemy/shared/stores/session/session-capabilities";
import { sessionGameplayStore } from "@/features/alchemy/shared/stores/session/session-gameplay-store";
import { setGold } from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { createSessionPersistence } from "@/features/alchemy/shared/storage";

function setup() {
  let fail = true;
  const writes: string[] = [];
  const session = createGameSession({
    saveBackend: createSaveBackend({
      write: async (_key, value) => {
        writes.push(value);
        return fail ? { ok: false, error: "disk full" } : { ok: true };
      },
    }),
  });
  const persistence = createSessionPersistence(session);
  return {
    session,
    persistence,
    writes,
    recover: () => {
      fail = false;
    },
  };
}

afterEach(() => vi.restoreAllMocks());

it("releasing an older tracker preserves the newer owner's pending action and retry", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { session, persistence, recover, writes } = setup();
  const staleRetry = vi.fn();
  const releaseOld = persistence.trackProgress(staleRetry);
  let retry: Promise<unknown> | undefined;
  const liveRetry = vi.fn(() => {
    retry = persistence.checkpoint();
  });
  const releaseNew = persistence.trackProgress(liveRetry);
  const completed = vi.fn();
  try {
    dispatchRunSessionCommand((draft) => acceptCommand(setGold(draft, 70)), undefined, session);
    persistence.afterProgressSaved(completed);
    expect(await persistence.checkpoint()).toBe("failed");
    releaseOld();
    expect(persistence.readProgress().kind).toBe("failed");
    expect(guardProgressAction(session, () => true, false)()).toBe(false);
    recover();
    persistence.retryProgress();
    await retry;
    expect(liveRetry).toHaveBeenCalledOnce();
    expect(staleRetry).not.toHaveBeenCalled();
    expect(completed).toHaveBeenCalledOnce();
    expect(JSON.parse(writes.at(-1)!).gold).toBe(70);
  } finally {
    releaseOld();
    releaseNew();
    await session.dispose();
  }
});

it("releasing the current tracker restores the preceding retry owner without cancelling progress", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { session, persistence, recover } = setup();
  let retry: Promise<unknown> | undefined;
  const previousRetry = vi.fn(() => {
    retry = persistence.checkpoint();
  });
  const releasePrevious = persistence.trackProgress(previousRetry);
  const removedRetry = vi.fn();
  const releaseCurrent = persistence.trackProgress(removedRetry);
  try {
    dispatchRunSessionCommand((draft) => acceptCommand(setGold(draft, 70)), undefined, session);
    expect(await persistence.checkpoint()).toBe("failed");
    releaseCurrent();
    releaseCurrent();
    recover();
    persistence.retryProgress();
    await retry;
    expect(previousRetry).toHaveBeenCalledOnce();
    expect(removedRetry).not.toHaveBeenCalled();
    expect(persistence.readProgress().kind).toBe("idle");
  } finally {
    releaseCurrent();
    releasePrevious();
    await session.dispose();
  }
});

it("autosave replacement resumes pending progress without revealing it or losing completion feedback", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { session, persistence, recover, writes } = setup();
  const display = sessionGameplayStore(session).presentation;
  const before = display.getState().runProfile.gold;
  const first = createAlchemyAutosaveLifecycle(() => true, undefined, session, true);
  let replacement: ReturnType<typeof createAlchemyAutosaveLifecycle> | undefined;
  const completed = vi.fn();
  try {
    dispatchRunSessionCommand((draft) => acceptCommand(setGold(draft, 70)), undefined, session);
    persistence.afterProgressSaved(completed);
    await first.drain();
    expect(persistence.readProgress().kind).toBe("failed");
    first.dispose(false);
    expect(persistence.readProgress().kind).toBe("failed");
    expect(display.getState().runProfile.gold).toBe(before);
    expect(guardProgressAction(session, () => true, false)()).toBe(false);
    recover();
    replacement = createAlchemyAutosaveLifecycle(() => true, undefined, session, true);
    // No new gameplay commit: the replacement must recover session-owned work.
    await replacement.drain();
    expect(JSON.parse(writes.at(-1)!).gold).toBe(70);
    expect(persistence.readProgress().kind).toBe("idle");
    expect(display.getState().runProfile.gold).toBe(70);
    expect(completed).toHaveBeenCalledOnce();
  } finally {
    first.dispose(false);
    replacement?.dispose(false);
    await session.dispose();
  }
});

it("detached tracking still advances pending revisions and rejects an older acknowledgement", async () => {
  const { session, persistence, recover } = setup();
  recover();
  const display = sessionGameplayStore(session).presentation;
  const before = display.getState().runProfile.gold;
  const release = persistence.trackProgress(() => {});
  const completed = vi.fn();
  try {
    dispatchRunSessionCommand((draft) => acceptCommand(setGold(draft, 70)), undefined, session);
    persistence.afterProgressSaved(completed);
    const earlier = persistence.snapshot();
    release();
    // Internal settlement remains possible while player actions are guarded.
    dispatchRunSessionCommand((draft) => acceptCommand(setGold(draft, 80)), undefined, session);
    expect(await persistence.write(earlier)).toBe("saved");
    expect(persistence.readProgress().kind).toBe("saving");
    expect(display.getState().runProfile.gold).toBe(before);
    expect(completed).not.toHaveBeenCalled();
    expect(await persistence.checkpoint()).toBe("saved");
    expect(display.getState().runProfile.gold).toBe(80);
    expect(completed).toHaveBeenCalledOnce();
  } finally {
    release();
    await session.dispose();
  }
});
