import { setBattleActiveForTest as setHasActiveBattle } from "../../../../helpers/run-domain-store-test";
import { beforeEach, describe, expect, it } from "vitest";
import { deepFreeze } from "@/features/alchemy/shared/stores/store-utils";
import { readGameplayState, useGameplayStateStore } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  setFinishedRunCharacters,
  setGold,
  setHasActiveRun,
  setMaterials as setRunProfileMaterials,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActiveRun, readBattle, readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { defaultGameSession } from "@/app/application-session";

beforeEach(() => {
  useGameplayStateStore.setState(useGameplayStateStore.getInitialState(), true);
});

describe("aggregate read ports", () => {
  it("reads every gameplay lifetime from the authoritative aggregate", () => {
    dispatchRunSessionCommand(
      (draft) => {
        setGold(draft, 23);
        setHasActiveRun(draft, true);
        setHasActiveBattle(draft, true);
        setRunProfileMaterials(draft, { wood: 4, iron: 0, herbs: 0, food: 0, gems: 0, stone: 0, hide: 0 });
        setFinishedRunCharacters(draft, ["knight"]);

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );

    expect(readRunProfile(defaultGameSession).gold).toBe(23);
    expect(readRunSession(defaultGameSession).hasActiveRun).toBe(true);
    expect(readBattle(defaultGameSession).hasActiveBattle).toBe(true);
    expect(readRunProfile(defaultGameSession).materialInventory.wood).toBe(4);
    expect(readGameplayState(defaultGameSession).profile.finishedRunCharacters).toEqual(["knight"]);
  });

  it("keeps feature-facing imperative reads data-only", () => {
    expect(readActiveRun(defaultGameSession)).not.toHaveProperty("setGold");
    expect(readActiveRun(defaultGameSession)).not.toHaveProperty("nextRunRandom");
    expect(readRunProfile(defaultGameSession)).not.toHaveProperty("unlockTalent");
    expect(readRunSession(defaultGameSession)).not.toHaveProperty("setRewardState");
    expect(readBattle(defaultGameSession)).not.toHaveProperty("setSyncedBattleState");
  });

  it("deep-freezes nested read values in development", () => {
    dispatchRunSessionCommand((draft) => acceptCommand(setHasActiveRun(draft, true)), undefined, defaultGameSession);

    const session = readRunSession(defaultGameSession);
    expect(Object.isFrozen(session)).toBe(true);
    expect(Object.isFrozen(session.rewardFlow.state)).toBe(true);
    expect(Object.isFrozen(session.rewardFlow.state.destinations)).toBe(true);
    const child = { progress: [1] };
    const shallow = Object.freeze({ child });
    deepFreeze(shallow);
    expect(() => child.progress.push(2)).toThrow(TypeError);
    const key = { id: 1 };
    const tree = { map: new Map([[key, shallow]]), set: new Set([child]), self: null as unknown };
    tree.self = tree;
    expect(deepFreeze(tree)).toBe(tree);
    expect(Object.isFrozen(key)).toBe(true);
    expect(deepFreeze(tree)).toBe(tree);
  });
});
