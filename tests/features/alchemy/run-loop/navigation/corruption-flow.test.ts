import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCorruptionFlowHandlers } from "@/features/alchemy/run-loop/navigation/corruption-flow";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setCorruptionResult, setRunDeck } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActiveRun } from "@/features/alchemy/shared/stores/run-reads";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { makeTestCard } from "../../../../fixtures/cards";
import { defaultGameSession } from "@/app/application-session";
beforeEach(() => {
  resetTransientRunUi(defaultGameSession);
});

describe("corruption destination exit", () => {
  it("handleCorruptCard ignores a second pick after a result is stored", () => {
    const original = makeTestCard({ id: "slash" });
    dispatchRunSessionCommand(
      (draft) => {
        setRunDeck(draft, [original]);
        setCorruptionResult(draft, {
          originalCard: original,
          corruptedCard: { ...original, corrupted: true },
          transformed: false,
          delta: -1,
        });

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );

    createCorruptionFlowHandlers(
      {
        leaveVisit: vi.fn(),
      },
      defaultGameSession,
    ).handleCorruptCard(1);

    expect(readActiveRun(defaultGameSession).runDeck).toEqual([original]);
  });
});
