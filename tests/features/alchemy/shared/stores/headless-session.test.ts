import { describe, expect, it, vi } from "vitest";

// Importing independent gameplay must never construct the shipping application
// or load its React presentation adapters, even before a session is created.
vi.mock("@/app/application-session", () => {
  throw new Error("Headless gameplay loaded the application session");
});
vi.mock("react", () => {
  throw new Error("Headless gameplay loaded React");
});

import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import { createSessionPersistence } from "@/features/alchemy/shared/storage/session-persistence";
import { createPlaythroughController } from "@/app/playthrough/controller";
import { readBattle, readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
import { commitEndTurn } from "@/features/alchemy/shared/stores/battle-commands";

describe("headless session dependency boundary", () => {
  it("starts, resolves combat and round-trips progress without application initialization", async () => {
    const session = createGameSession({ runtimeInputs: { generateRunSeed: () => 7 } });
    let restored: ReturnType<typeof createGameSession> | undefined;
    try {
      const controller = createPlaythroughController(session);
      controller.flow.goToScreen("game-mode-select");
      controller.flow.beginCampaign();
      controller.flow.handleCharacterSelect("knight");
      expect(readBattle(session).hasActiveBattle).toBe(true);
      const turn = readBattle(session).battleState.turn;
      expect(commitEndTurn(readBattle(session).battleState, session)).not.toBeNull();
      expect(readBattle(session).battleState.turn).toBeGreaterThan(turn);
      const save = createSessionPersistence(session).snapshot();
      restored = createGameSession({ initialSave: save });
      expect(readRunProfile(restored)).toEqual(readRunProfile(session));
      expect(createSessionPersistence(restored).snapshot()).toEqual(save);
    } finally {
      await session.dispose();
      await restored?.dispose();
    }
  });
});
