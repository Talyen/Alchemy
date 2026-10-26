import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { advanceToPlayerTurn, reduceSkipTurns } from "@/lib/battle/player-turn-transition";
import { MAX_HAND_SIZE } from "@/lib/game-constants";
import { companionLibrary, computeTalentEffects } from "@/lib/game-data";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { describe, expect, it } from "vitest";
import { patchBattleState } from "../../fixtures/battle";
import { makeTestCard as makeEnemyTestCard, makeTestCard } from "../../fixtures/cards";
import * as talentBattle from "../../fixtures/talent-battle";

describe("Talent talent turn rewards", () => {
  const { talents, battle, attack, play } = talentBattle;

  it.each([3, 7])("keeps The Returning Flight card when %i enemy-phase draws fill the hand", (count) => {
    const returning = { ...attack("returning42"), tags: ["archery" as const] };
    const state = battle({
      hand: Array.from({ length: count }, (_, i) => attack(`held-${i}`)),
      deck: Array.from({ length: 4 }, (_, i) => attack(`deck-${i}`)),
      discard: [returning],
      gearEffects: { recoverLastArcheryCard: 1 },
      uniqueGear: { lastArcheryUid: returning.uid },
    });
    const after = advanceToPlayerTurn(state);
    expect(after.hand).toHaveLength(MAX_HAND_SIZE);
    expect(after.discard).not.toContainEqual(returning);
    const recovered = [...after.hand, ...after.pendingHandCards].find((card) => card.id === returning.id)!;
    expect(recovered).toBeDefined();
    expect(after.uniqueGear.returningFlightUids).toContain(recovered.uid);
    expect(after.hand.length + after.pendingHandCards.length + after.deck.length + after.discard.length).toBe(
      count + 5,
    );
  });

  it("pays Dark Recovery next turn based on Mana at turn end, even if the enemy drains Mana", () => {
    const state = battle({
      mana: 0,
      maxMana: 3,
      talentEffects: talents("mana", "mana-arcane-wish"),
    });
    const ended = endPlayerTurn(state);
    expect(ended.state.mana).toBe(4);
    expect(ended.state.flags.darkRecoveryMana).toBe(0);
    expect(advanceToPlayerTurn({ ...state, mana: 0, flags: { ...state.flags, darkRecoveryMana: 0 } }).mana).toBe(3);
    expect(endPlayerTurn({ ...state, mana: 1 }).state.mana).toBe(3);
  });

  it("Turn-end mana tracking forwarded in resolveHasteTurn preserves manaAtTurnEnd on haste turns so wellspringKeepMana awards bonus mana", () => {
    const state = battle({
      mana: 3,
      maxMana: 3,
      playerStatuses: { haste: 1 },
      talentEffects: { wellspringKeepMana: 2 },
    });
    const resolution = endPlayerTurn(state);

    expect(resolution.kind).toBe("haste");
    expect(resolution.state.mana).toBe(3 + 2);
  });

  it("Tailwind draws for repeated Dodges and retains those cards into the next hand", () => {
    const state = battle({
      currentEnemy: { abilityIds: ["slash", "ray-of-frost", "block"] },
      talentEffects: { ...talents("dodge", "dodge-rolling-recovery"), dodgeChance: 95 },
      rng: () => 0.5,
      deck: Array.from({ length: 10 }, (_, i) => attack(`draw-${i}`)),
    });
    const dodged = applyEnemyAbility(
      state,
      makeEnemyTestCard({
        effects: [
          { kind: "damage", damageType: "physical", amount: 2 },
          { kind: "damage", damageType: "physical", amount: 2 },
        ],
      }),
      [],
    );
    expect(dodged.hand).toHaveLength(2);
    const after = endPlayerTurn(state).state;
    expect(after.hand.length).toBeGreaterThan(5);
    expect(after.hand.some((card) => card.id === "draw-9")).toBe(true);
  });

  it("Glacial Barrier requires a new Freeze and Thaw Dividend requires natural recovery", () => {
    const state = battle({
      enemyHealth: 10,
      enemyMaxHealth: 10,
      talentEffects: talents("freeze", "freeze-block-healing", "freeze-prevent-scaling"),
      deck: [attack("drawn")],
    });
    const frozen = play(state, { ...attack("freeze"), effects: [{ kind: "damage", damageType: "freeze", amount: 6 }] });
    expect(frozen.enemyCC.freezeSkipTurns).toBeGreaterThan(0);
    expect(frozen.playerStatuses.block).toBe(3);
    const recovered = reduceSkipTurns({ ...frozen, enemyCC: { ...frozen.enemyCC, freezeSkipTurns: 1 } });
    expect(recovered.hand.map((card) => card.id)).toContain("drawn");
    expect(reduceSkipTurns(recovered).hand).toEqual(recovered.hand);
    expect(reduceSkipTurns({ ...frozen, enemyHealth: 0 }).hand).toEqual(frozen.hand);
    expect(reduceSkipTurns({ ...frozen, playerHealth: 0 }).hand).toEqual(frozen.hand);
  });

  it("Tailwind and Pack Weave can both trigger on Dodge without playing drawn cards", () => {
    const state = battle({
      talentEffects: {
        ...computeTalentEffects({
          dodge: ["dodge-rolling-recovery"],
          companion: ["companion-loyal", "companion-tame"],
        }),
        dodgeChance: 95,
      },
      activeCompanion: companionLibrary.wolf,
      deck: [attack("draw1"), attack("draw2")],
      flags: { companionNextAttackBonus: 2 },
      rng: () => 0.1,
    });
    const after = applyEnemyAbility(
      state,
      makeEnemyTestCard({
        effects: [
          { kind: "damage", damageType: "physical", amount: 2 },
          { kind: "damage", damageType: "physical", amount: 2 },
        ],
      }),
      [],
    );
    expect(after.hand).toHaveLength(2);
    expect(after.enemyHealth).toBe(96);
    expect(after.flags.companionNextAttackBonus).toBe(0);
    expect(after.cardsPlayedThisTurn).toBe(0);
  });

  it("Mana Flare adds Burn buildup and decays enemy Armor", () => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      maxMana: 4,
      enemyMitigation: { armor: 3 },
      talentEffects: { burnDamageOnManaCrystalLoss: 3 },
    });
    const card = makeTestCard({ effects: [{ kind: "lose-max-mana", amount: 1 }] });
    const result = applyCardEffects(state, card, []);
    expect(result.enemyHealth).toBe(97);
    expect(result.enemyStatuses.burn).toBe(3);
    expect(result.enemyMitigation.armor).toBe(2);
  });
});
