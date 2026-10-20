import { addPlayerStatus } from "@/lib/battle/status-state";
import { describe, expect, it } from "vitest";
import { attack, battle, play } from "../../fixtures/unique-gear-battle";

/** First roll dodges; every later roll behaves as a miss for Dodge and crits. */
function dodgeFirstRng() {
  let calls = 0;
  return () => {
    calls += 1;
    return calls === 1 ? 0 : 0.99;
  };
}

const thornsEnemy = {
  currentEnemy: { traits: [{ id: "thorns", title: "Thorns", description: "" }] },
  enemyStatuses: { thorns: 1 },
  flags: { legacyEnemyThornsReady: true },
};

describe("dodged attack packets resolve no damage for repeats", () => {
  it("a fully dodged Everkeen card deals no repeat damage but still attempts", () => {
    const armed = addPlayerStatus(
      battle({ ...thornsEnemy, gearEffects: { forgeReadiesPhysicalRepeat: 1 }, rng: dodgeFirstRng() }),
      "forge",
      1,
    );
    expect(armed.uniqueGear.everkeenReady).toBe(true);
    const result = play(
      armed,
      attack("physical", { effects: [{ kind: "damage", damageType: "physical", amount: 4 }] }),
    );
    expect(result.enemyHealth).toBe(1000);
    // The legacy Thorns stack still sees the dodged attempt.
    expect(result.flags.legacyEnemyThornsReady).toBe(false);
    expect(result.enemyStatuses.thorns).toBe(0);
    expect(result.playerHealth).toBe(99);
  });

  it("a repeat replays only the packets that landed", () => {
    const armed = addPlayerStatus(
      battle({ gearEffects: { forgeReadiesPhysicalRepeat: 1 }, rng: dodgeFirstRng() }),
      "forge",
      1,
    );
    const card = attack("physical", {
      effects: [
        { kind: "damage", damageType: "physical", amount: 4 },
        { kind: "damage", damageType: "physical", amount: 4 },
      ],
    });
    const result = play(armed, card);
    // First packet dodged, second packet lands for 4 plus the arming Forge,
    // and the repeat replays only that landed packet.
    expect(result.enemyHealth).toBe(1000 - 5 - 5);
  });

  it("a fully dodged Archery card queues no echo", () => {
    const dodged = play(
      battle({ gearEffects: { archeryEchoNextTurn: 1 }, rng: () => 0 }),
      attack("physical", { tags: ["archery"] }),
    );
    expect(dodged.uniqueGear.archeryEchoes).toHaveLength(0);
    expect(dodged.enemyHealth).toBe(1000);
  });
});
