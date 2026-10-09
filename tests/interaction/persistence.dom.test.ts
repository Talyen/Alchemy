import { vi } from "vitest";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import { createSessionPersistence } from "@/features/alchemy/shared/storage";
import { createAlchemyAutosaveLifecycle } from "@/app/autosave-lifecycle";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import type { SaveBackend } from "@/lib/platform-save-backend";
import { deferred } from "../helpers/deferred";
import { defineSequenceFamily, requireProgress, type Scenario } from "./sequence";
import { advance, installFrames } from "./timing";

defineSequenceFamily("persistence", () => {
  installFrames();
  let gold = 0;
  let expectedGold: number | null = null;
  let clearing: Promise<boolean> | null = null;
  let acknowledged: { gold: number } | null = null;
  let failed = false;
  const pending: Array<{
    value: string;
    done: ReturnType<typeof deferred<Awaited<ReturnType<SaveBackend["write"]>>>>;
  }> = [];
  const messages: string[] = [];
  vi.spyOn(console, "error").mockImplementation((...args) => {
    messages.push(args.map(String).join(" "));
  });
  const session = createGameSession({
    saveBackend: {
      readCandidates: async () => ({ ok: true, candidates: [] }),
      write: (_key, value) => {
        const done = deferred<Awaited<ReturnType<SaveBackend["write"]>>>();
        pending.push({ value, done });
        return done.promise;
      },
      writeSync: (_key, value) => {
        acknowledged = JSON.parse(value);
        return { ok: true };
      },
      clear: async () => {
        acknowledged = null;
        return { ok: true };
      },
    },
  });
  const persistence = createSessionPersistence(session);
  const lifecycle = createAlchemyAutosaveLifecycle(undefined, undefined, session);
  const observe = () => ({ gold, expectedGold, acknowledged, pending: pending.length, failed, messages });
  async function complete() {
    const write = pending.shift();
    if (write) {
      if (!failed) acknowledged = JSON.parse(write.value);
      write.done.resolve(failed ? { ok: false, error: new Error("injected storage failure") } : { ok: true });
    }
    await advance(1);
  }
  return {
    fixture: { gold: 0, backend: "deferred isolated memory" },
    // A confirmed wipe cancels dirty revisions; only its I/O can finish until it settles.
    actions: () =>
      clearing
        ? ["complete", "settle", "recover", "clear"]
        : ["change", "flush", "settle", "fail", "recover", "complete", "terminal", "clear"],
    async run(action) {
      if (action === "change") {
        gold++;
        expectedGold = gold;
        dispatchRunSessionCommand((draft) => acceptCommand(setGold(draft, gold)), undefined, session);
      }
      if (action === "clear") {
        expectedGold = null;
        clearing = persistence.clear();
      }
      if (action === "flush") lifecycle.flush();
      if (action === "terminal") lifecycle.flush(true);
      if (action === "fail") failed = true;
      if (action === "recover") failed = false;
      if (action === "complete") await complete();
      if (action === "settle" && !failed) {
        for (let count = 0; count < 8; count++) {
          await advance(5000);
          await complete();
        }
        if (clearing) {
          requireProgress(await clearing, "save-clear-completes", observe());
          clearing = null;
        }
        requireProgress(
          pending.length === 0 && (expectedGold === null ? acknowledged === null : acknowledged?.gold === expectedGold),
          "save-latest-revision-acknowledged",
          observe(),
        );
      } else await advance(1);
    },
    check() {
      requireProgress(
        messages.every((message) => message.includes("injected storage failure")),
        "save-only-expected-errors",
        messages,
      );
      requireProgress(!acknowledged || acknowledged.gold <= gold, "save-no-future-revision", observe());
    },
    observe,
    async settle(this: Scenario) {
      await this.run("settle");
    },
    async dispose() {
      lifecycle.dispose(false);
      for (let count = 0; count < 8 && pending.length; count++) {
        failed = false;
        await complete();
      }
      await persistence.resetForTests();
      await session.dispose();
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      vi.useRealTimers();
    },
  };
});
