import { beforeEach, expect, it, vi } from "vitest";
import { createCorruptionFlowHandlers } from "@/features/alchemy/run-loop/navigation/corruption-flow";
import { setCorruptionResult, setRunDeck } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActiveRun } from "@/features/alchemy/shared/stores/run-reads";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { makeTestCard } from "../../../../fixtures/cards";
import { defaultGameSession } from "@/app/application-session";
import { mutateRunForTest } from "../../../../helpers/run-domain-store-test";
beforeEach(() => {
  resetTransientRunUi(defaultGameSession);
});

it("corruption destination exit handleCorruptCard ignores a second pick after a result is stored", () => {
  const original = makeTestCard({ id: "slash" });
  mutateRunForTest((draft) => {
    setRunDeck(draft, [original]);
    setCorruptionResult(draft, {
      originalCard: original,
      corruptedCard: { ...original, corrupted: true },
      transformed: false,
      delta: -1,
    });
  });

  createCorruptionFlowHandlers(
    {
      leaveVisit: vi.fn(),
    },
    defaultGameSession,
  ).handleCorruptCard(1);

  expect(readActiveRun(defaultGameSession).runDeck).toEqual([original]);
});
