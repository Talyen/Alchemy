import { describe, expect, it } from "vitest";
import { createBattleState, defaultTalentEffects } from "@/lib/battle";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { handlePostPlayCardDestination } from "@/lib/battle/card-consume";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { applyScaledLeechHealing } from "@/lib/battle/damage-rider-leech";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { applyWishEffect } from "@/lib/battle/wish";
import { defaultGearEffects } from "@/lib/gear";
import { enemyBestiary } from "@/lib/game-data";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

const enemy = enemyBestiary.find((candidate) => candidate.id === "skeleton")!;

describe("new ordinary affix interactions", () => {
  it("starts with Thorns and increases only Armor that is actually granted", () => {
    const battle = createBattleState({
      runDeck: [makeTestCard()],
      currentEnemy: enemy,
      gearEffects: { ...defaultGearEffects, startThorns: 3, startArmor: 2, flatArmorGained: 1 },
    });
    expect(battle.playerStatuses).toMatchObject({ thorns: 3, armor: 3 });

    const noArmorSource = createBattleState({
      runDeck: [makeTestCard()],
      currentEnemy: enemy,
      gearEffects: { ...defaultGearEffects, flatArmorGained: 1 },
    });
    expect(noArmorSource.playerStatuses.armor).toBe(0);

    const manaShell = createBattleState({
      runDeck: [makeTestCard()],
      currentEnemy: enemy,
      talentEffects: { ...defaultTalentEffects, manaShellActive: true },
      gearEffects: { ...defaultGearEffects, flatArmorGained: 1 },
    });
    expect(manaShell.playerStatuses.armor).toBe(manaShell.maxMana + 1);
  });

  it("turns a broken Block into stronger Thorns and regrows Armor after retaliation", () => {
    const state = patchBattleState({
      playerStatuses: { block: 3 },
      enemyHealth: 30,
      enemyMaxHealth: 30,
      gearEffects: {
        thornsOnBlockDepleted: 2,
        flatThornsDamage: 2,
        armorOnThornsDamage: 1,
        flatArmorGained: 1,
      },
      rng: () => 0.99,
    });
    const attack = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 3 }] });
    const result = applyEnemyAbility(state, attack, []);

    expect(result.playerStatuses).toMatchObject({ block: 0, thorns: 0, armor: 2 });
    expect(result.enemyHealth).toBe(26);
  });

  it("ticks existing Poison on Consume without clearing the stack, then pays card rewards", () => {
    const consumed = makeTestCard({
      id: "consumed-burn",
      consume: true,
      cost: 1,
      effects: [{ kind: "damage", damageType: "burn", amount: 1 }],
    });
    const drawn = makeTestCard({ id: "drawn-card" });
    const state = patchBattleState({
      mana: 1,
      maxMana: 3,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: { poison: 5 },
      deck: [drawn],
      gearEffects: {
        poisonTickOnConsume: 1,
        forgeOnConsumeBurnCard: 2,
        manaOnPaidConsume: 2,
        drawOnLastHandConsume: 1,
      },
      rng: () => 0.99,
    });
    const result = handlePostPlayCardDestination(state, consumed, { lastCardInHand: true, manaSpent: 1 });

    expect(result.enemyHealth).toBe(25);
    expect(result.enemyStatuses.poison).toBe(4);
    expect(result.playerStatuses.forge).toBe(2);
    expect(result.mana).toBe(3);
    expect(result.hand.map((card) => card.id)).toContain(drawn.id);
  });

  it("does not refund Mana for a free Consumed card", () => {
    const consumed = makeTestCard({ consume: true, cost: 0, effects: [] });
    const state = patchBattleState({ mana: 0, gearEffects: { manaOnPaidConsume: 2 } });
    expect(handlePostPlayCardDestination(state, consumed).mana).toBe(0);
  });

  it("refunds Distilled only when Mana paid for a Consumed Freeze card", () => {
    const consumed = makeTestCard({
      id: "consumed-freeze",
      consume: true,
      cost: 2,
      effects: [{ kind: "damage", damageType: "freeze", amount: 1 }],
    });
    const state = patchBattleState({
      hand: [consumed],
      mana: 0,
      maxMana: 3,
      playerStatuses: { block: 6 },
      gearEffects: { blockPaysFreezeMana: 1, manaOnPaidConsume: 2 },
    });
    const blockPaid = playBattleCardResolved(state, consumed.id, 0).state;
    expect(blockPaid.playerStatuses.block).toBe(0);
    expect(blockPaid.mana).toBe(0);

    const partlyManaPaid = playBattleCardResolved(
      { ...state, mana: 1, playerStatuses: { ...state.playerStatuses, block: 3 } },
      consumed.id,
      0,
    ).state;
    expect(partlyManaPaid.playerStatuses.block).toBe(0);
    expect(partlyManaPaid.mana).toBe(2);
  });

  it("guards a summon and gains Forge when its Companion damages a Burning enemy", () => {
    const summon = makeTestCard({
      id: "summon-wolf",
      effects: [{ kind: "summon-companion", companionId: "wolf" }],
    });
    const state = patchBattleState({
      hand: [summon],
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { burn: 3 },
      gearEffects: { blockOnCompanionSummon: 3, forgeOnCompanionDamageVsBurning: 2 },
      rng: () => 0.99,
    });
    const summoned = playBattleCardResolved(state, summon.id, 0).state;
    expect(summoned.playerStatuses.block).toBe(3);
    expect(summoned.activeCompanion?.id).toBe("wolf");

    const afterAttack = processCompanionTurnStart(summoned, []);
    expect(afterAttack.enemyHealth).toBeLessThan(summoned.enemyHealth);
    expect(afterAttack.playerStatuses.forge).toBe(2);
    expect(
      processCompanionTurnStart({ ...summoned, enemyStatuses: { ...summoned.enemyStatuses, burn: 0 } }, [])
        .playerStatuses.forge,
    ).toBe(0);
  });

  it("draws from Archery, takes Covering Block, and gains Armor from Nature", () => {
    const archery = makeTestCard({ id: "archery-card", tags: ["archery"], effects: [] });
    const nature = makeTestCard({ id: "nature-card", effects: [{ kind: "damage", damageType: "nature", amount: 1 }] });
    const state = patchBattleState({
      hand: [archery],
      deck: [nature],
      gearEffects: { archeryDrawChance: 100, blockOnArcheryWithoutBlock: 3, armorOnNatureCard: 2 },
      rng: () => 0.01,
    });
    const afterArchery = playBattleCardResolved(state, archery.id, 0).state;
    expect(afterArchery.playerStatuses.block).toBe(3);
    expect(afterArchery.hand.map((card) => card.id)).toContain(nature.id);

    const afterNature = playBattleCardResolved(afterArchery, nature.id, 0).state;
    expect(afterNature.playerStatuses.armor).toBe(2);
  });

  it("grants Block for a Wish, an actual Leech heal, and spending the last Forge", () => {
    const wished = applyWishEffect(patchBattleState({ gearEffects: { blockOnWish: 2 } }), undefined, 1, []);
    expect(wished.playerStatuses.block).toBe(2);

    const leeching = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 20,
      gearEffects: { leechBlockChance: 15 },
      rng: () => 0.01,
    });
    const healed = applyScaledLeechHealing(leeching, 4, []);
    expect(healed.playerHealth).toBe(14);
    expect(healed.playerStatuses.block).toBe(4);
    expect(applyScaledLeechHealing({ ...leeching, rng: () => 0.99 }, 4, []).playerStatuses.block).toBe(0);

    const strike = makeTestCard({
      id: "spend-forge",
      effects: [{ kind: "damage", damageType: "physical", amount: 2 }],
    });
    const forgeState = patchBattleState({
      hand: [strike],
      playerStatuses: { forge: 1 },
      gearEffects: { blockOnLastForgeSpent: 3 },
      rng: () => 0.99,
    });
    const spent = playBattleCardResolved(forgeState, strike.id, 0).state;
    expect(spent.playerStatuses).toMatchObject({ forge: 0, block: 3 });
    const stillForged = playBattleCardResolved(
      { ...forgeState, playerStatuses: { ...forgeState.playerStatuses, forge: 2 } },
      strike.id,
      0,
    ).state;
    expect(stillForged.playerStatuses).toMatchObject({ forge: 1, block: 0 });
  });
});
