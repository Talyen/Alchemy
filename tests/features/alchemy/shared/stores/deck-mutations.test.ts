import { describe, expect, it } from "vitest";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-reads";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  appendBoonToRunWithDiscovery,
  appendCardToRunWithDiscovery,
} from "@/features/alchemy/shared/stores/deck-mutations";
import { makeTestCard } from "../../../../fixtures/cards";

describe("run acquisition with discovery", () => {
  it("appends cards to the deck and records each card id once", async () => {
    await using session = createGameSession({ runtimeInputs: { generateRunSeed: () => 7 } });
    const card = makeTestCard();

    dispatchRunSessionCommand(
      (transaction) => acceptCommand(appendCardToRunWithDiscovery(transaction, card)),
      undefined,
      session,
    );
    dispatchRunSessionCommand(
      (transaction) => acceptCommand(appendCardToRunWithDiscovery(transaction, card)),
      undefined,
      session,
    );

    const state = readGameplayState(session);
    expect(state.run.activeRun.runDeck.slice(-2)).toEqual([card, card]);
    expect(state.profile.discoveredCardIds).toEqual([card.id]);
  });

  it("appends a boon once and records its trinket id", async () => {
    await using session = createGameSession({ runtimeInputs: { generateRunSeed: () => 7 } });

    dispatchRunSessionCommand(
      (transaction) => acceptCommand(appendBoonToRunWithDiscovery(transaction, "bone-charm")),
      undefined,
      session,
    );
    dispatchRunSessionCommand(
      (transaction) => acceptCommand(appendBoonToRunWithDiscovery(transaction, "bone-charm")),
      undefined,
      session,
    );

    const state = readGameplayState(session);
    expect(state.run.activeRun.runBoons).toEqual(["bone-charm"]);
    expect(state.profile.discoveredTrinketIds).toContain("bone-charm");
  });
});
