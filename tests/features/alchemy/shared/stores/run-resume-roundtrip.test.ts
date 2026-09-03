import { beforeEach, describe, expect, it } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { cardLibrary } from "@/lib/game-data";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { createSeededRng } from "@/lib/utils";
import { ROUTE_SCREENS } from "@/lib/routing";
import { decodeRunResumeSnapshot } from "@/features/alchemy/shared/stores/run-resume-codec";
import { runProfilePersistenceCodec } from "@/features/alchemy/shared/stores/run-save-readers";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { setCompanionRewardCards, setRewardState } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { resetRunDomainStore, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";

beforeEach(() => {
  resetRunDomainStore();
});

function startLabyrinthRun(): void {
  setRunProgress({ characterId: "knight", contentSystemType: "labyrinth" });
  setRunSession({
    hasActiveRun: true,
    labyrinthMap: generateLabyrinthMap(createSeededRng(1)),
    activeLabyrinthModifiers: ["septic"],
    activeLabyrinthRewardModifiers: ["generous"],
  });
}

describe("labyrinth modifier persistence", () => {
  it("keeps expedition twists on saves made outside combat", () => {
    startLabyrinthRun();

    const snap = snapshotRun(ROUTE_SCREENS.LABYRINTH_MAP);
    expect(snap.activeCombat).toBeNull();
    expect(snap.activeLabyrinthModifiers).toEqual(["septic"]);
    expect(snap.activeLabyrinthRewardModifiers).toEqual(["generous"]);

    const decoded = decodeRunResumeSnapshot(snap);
    expect(decoded.session.activeLabyrinthModifiers).toEqual(["septic"]);
    expect(decoded.session.activeLabyrinthRewardModifiers).toEqual(["generous"]);
  });

  it("backfills twists from legacy combat parcels", () => {
    startLabyrinthRun();

    const snap = snapshotRun(ROUTE_SCREENS.LABYRINTH_MAP);
    const decoded = decodeRunResumeSnapshot({
      ...snap,
      activeLabyrinthModifiers: [],
      activeLabyrinthRewardModifiers: [],
      activeCombat: {
        battleState: defaultBattleState(),
        pendingBattleTransition: null,
        activeLabyrinthModifiers: ["septic"],
        activeLabyrinthRewardModifiers: ["generous"],
      },
    });
    expect(decoded.session.activeLabyrinthModifiers).toEqual(["septic"]);
    expect(decoded.session.activeLabyrinthRewardModifiers).toEqual(["generous"]);
  });
});

describe("homestead hydrate parity", () => {
  it("prunes unknown companions on load like live mutations do", () => {
    const defaults = runProfilePersistenceCodec.createDefault();
    const fields = {
      ...defaults,
      bondedCompanions: { "no-such-companion": 1 } as unknown as typeof defaults.bondedCompanions,
    };
    dispatchRunSessionCommand((draft) => runProfilePersistenceCodec.hydrate(fields, draft));
    expect(readGameplayState().runProfile.bondedCompanions).toEqual({});
  });
});

describe("interrupted mid-claim rewards", () => {
  it("keeps both spoils and companion gifts when the claim is interrupted", () => {
    const primary = cardLibrary.find((card) => card.id === "slash")!;
    const companion = cardLibrary.find((card) => card.effects.some((effect) => effect.kind === "summon-companion"))!;
    setRunSession({
      hasActiveRun: true,
      rewardClaimInFlight: true,
      rewardState: { ...createEmptyRewardState(), rewardType: "card", choices: [primary], gold: 7 },
      companionRewardCards: [companion],
    });

    const snap = snapshotRun(ROUTE_SCREENS.REWARDS);
    expect(snap.interruptedFlow.kind).toBe("companion-reward");
    if (snap.interruptedFlow.kind === "companion-reward") {
      expect(snap.interruptedFlow.pending.rewardType).toBe("card");
      if (snap.interruptedFlow.pending.rewardType === "card") {
        expect(snap.interruptedFlow.pending.choiceIds).toEqual([primary.id]);
      }
      expect(snap.interruptedFlow.pending.companionChoiceIds).toEqual([companion.id]);
      expect(snap.interruptedFlow.pending.gold).toBe(7);
    }

    dispatchRunSessionCommand((draft) => {
      setRewardState(draft, createEmptyRewardState());
      setCompanionRewardCards(draft, null);
    });
    restoreRun(snap, {}, {});

    const restored = readRunSession().rewardState;
    expect(restored.rewardType).toBe("card");
    if (restored.rewardType === "card") {
      expect(restored.choices.map((choice) => choice.id)).toEqual([primary.id]);
    }
    expect(readRunSession().companionRewardCards?.map((choice) => choice.id)).toEqual([companion.id]);
  });
});
