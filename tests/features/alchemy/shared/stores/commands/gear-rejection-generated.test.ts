import { expect, it } from "vitest";
import { createGameSession } from "@/features/alchemy/shared/stores/session/game-session";
import {
  readGameplayState,
  subscribeGameplayCommits,
} from "@/features/alchemy/shared/stores/session/gameplay-state-reads";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/session/gameplay-command";
import { mutateGearWithRunHealthSync } from "@/features/alchemy/shared/stores/commands/gear-session-command";
import {
  applyCurrencyToGear,
  equipGear,
  salvageGear,
  unequipGear,
} from "@/features/alchemy/shared/stores/commands/gear-commands";
import type { GearInstance } from "@/lib/gear";
import { createRunRngState, createSeededRng, stepRunRng } from "@/lib/rng";
import { setRunActivityForTest } from "../../../../../helpers/run-domain-store-test";

const seeds = Array.from(
  { length: process.env.ALCHEMY_INTERACTION_TIER === "nightly" ? 128 : 16 },
  (_, index) => index + 1,
);

it.each(seeds)("rejected equipment actions preserve ownership and RNG (seed %i)", async (seed) => {
  const random = createSeededRng(seed);
  const integer = (max: number) => Math.floor(random() * max);
  const sword: GearInstance = {
    instanceId: `sword-${seed}`,
    definitionId: "shortsword-basic",
    affixes: [{ id: "flat-physical", value: 1 }],
  };
  const armor: GearInstance = { instanceId: `armor-${seed}`, definitionId: "leather-armor-basic", affixes: [] };
  const missing = { ...sword, instanceId: `missing-${seed}` };
  const rng = createRunRngState(Math.floor(random() * 0x1_0000_0000));
  const draws = 1 + integer(8);
  for (let index = 0; index < draws; index++) stepRunRng(rng, "rewards");

  await using session = createGameSession();
  dispatchGameplayCommand(
    (draft) => {
      mutateGearWithRunHealthSync(draft, {
        mutate: (gear) => {
          gear.addInstance(sword, "knight");
          gear.addInstance(armor, "rogue");
          gear.equip("knight", "main-hand", sword);
        },
      });
      setRunActivityForTest(draft, "destination");
      draft.run.activeRun.rng = rng;
      return acceptCommand();
    },
    undefined,
    session,
  );
  const before = readGameplayState(session);
  expect(before.gear.inventories.knight).toEqual([sword]);
  expect(before.gear.inventories.rogue).toEqual([armor]);
  expect(before.gear.loadouts.knight["main-hand"]).toBe(sword.instanceId);
  expect(before.gear.loadouts.knight.body).toBeNull();
  expect(before.gear.craftingCurrencies.voidstone).toBe(0);
  const original = structuredClone(before);
  let commits = 0;
  const unsubscribe = subscribeGameplayCommits(() => commits++, session);
  const actions = [
    () => equipGear("knight", "main-hand", missing, session),
    () => equipGear("knight", "body", sword, session),
    () => equipGear("knight", "main-hand", sword, session),
    () => unequipGear("knight", "body", session),
    () => salvageGear(missing.instanceId, session),
    () => applyCurrencyToGear("voidstone", sword.instanceId, undefined, session),
  ];
  try {
    // Every kind of rejection occurs, in a seed-dependent order and repetition.
    for (let index = actions.length - 1; index > 0; index--) {
      const other = integer(index + 1);
      [actions[index], actions[other]] = [actions[other]!, actions[index]!];
    }
    for (const action of [...actions, ...Array.from({ length: 12 }, () => actions[integer(actions.length)]!)]) {
      expect(action()).toBe(false);
      expect(readGameplayState(session)).toBe(before);
      expect(readGameplayState(session)).toEqual(original);
    }
    expect(commits).toBe(0);
  } finally {
    unsubscribe();
  }
});
