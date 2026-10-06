import "../../../../helpers/mock-audio";

import { beforeEach, describe, expect, it } from "vitest";
import { cardById } from "@/lib/game-data";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { emptyAlchemyVisit } from "@/lib/active-run-session/alchemy-visits";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { resetRunDomainStore, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { defaultGameSession } from "@/app/application-session";

beforeEach(() => resetRunDomainStore());

describe("support room resume after claiming combat rewards", () => {
  it.each(["labyrinth-map", "corruption"] as const)("does not fabricate rewards from routing markers on %s", (kind) => {
    setRunProgress({ characterId: "knight", contentSystemType: "labyrinth" });
    setRunSession({
      hasActiveRun: true,
      activity: kind === "corruption" ? { kind, data: null } : { kind },
      rewardState: {
        ...createEmptyRewardState(),
        lastVictoryEnemyType: "normal",
        lastVictoryContentSystem: "labyrinth",
      },
    });
    const saved = snapshotRun(undefined, defaultGameSession);
    expect(saved.interruptedFlow.kind).toBe("none");
    restoreRun(saved, {}, {}, defaultGameSession);
    expect(readRunSession(defaultGameSession).activity.kind).toBe(kind);
  });
  it.each(["campfire", "transmutation"] as const)(
    "keeps the saved %s visit instead of reopening an empty reward",
    (kind) => {
      const visit = { ...emptyAlchemyVisit(), offers: [cardById["health-potion"]!] };
      setRunProgress({ characterId: "knight", contentSystemType: "campaign" });
      setRunSession({
        hasActiveRun: true,
        activity: { kind, data: visit },
        rewardState: {
          ...createEmptyRewardState(),
          lastVictoryEnemyType: "normal",
          lastVictoryContentSystem: "campaign",
        },
      });
      const saved = snapshotRun(undefined, defaultGameSession);
      restoreRun(saved, {}, {}, defaultGameSession);
      expect(readRunSession(defaultGameSession).activity).toEqual({ kind, data: visit });
    },
  );
});
