import { describe, expect, it } from "vitest";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { addPlayerStatus } from "@/lib/battle/status-state";
import { attack, battle, play } from "../../fixtures/unique-gear-battle";

describe("Unique damage repeats retain the resolved attack", () => {
  it("Returning Gale echoes Poison Dagger's conversion without spending a newly prepared conversion", () => {
    const arrow = attack("physical", { tags: ["archery"] });
    const played = play(battle({ gearEffects: { archeryEchoNextTurn: 1 }, flags: { nextHitPoison: true } }), arrow);
    expect(played.uniqueGear.archeryEchoes[0]?.effects).toEqual([{ kind: "damage", damageType: "poison", amount: 10 }]);
    const echoed = advanceToPlayerTurn({ ...played, flags: { ...played.flags, nextHitPoison: true } });
    expect(echoed.enemyStatuses.poison).toBe(15);
    expect(echoed.flags.nextHitPoison).toBe(true);
  });

  it("Everkeen repeats the Leech granted by Predator's Focus", () => {
    const charged = addPlayerStatus(
      battle({ playerHealth: 50, gearEffects: { forgeReadiesPhysicalRepeat: 1 }, flags: { nextHitLeech: true } }),
      "forge",
      1,
    );
    const result = play(charged, attack("physical"));
    expect(result.playerHealth).toBe(61);
    expect(result.flags.nextHitLeech).toBe(false);
  });

  it("Returning Gale halves Kingbreaker's added Armor damage along with the Stun packet", () => {
    const played = play(
      battle({ gearEffects: { archeryEchoNextTurn: 1, armorIncreasesStun: 1 }, enemyMitigation: { armor: 8 } }),
      attack("stun", { tags: ["archery"], effects: [{ kind: "damage", damageType: "stun", amount: 4 }] }),
    );
    expect(played.enemyHealth).toBe(988);
    expect(advanceToPlayerTurn(played).enemyHealth).toBe(982);
  });
});
