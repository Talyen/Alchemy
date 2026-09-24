import { describe, expect, it } from "vitest";
import {
  cardById,
  companionLibrary,
  computeTalentEffects,
  enemyBestiary,
  talentPool,
  type BattleCard,
  type KeywordId,
} from "@/lib/game-data";
import { createBattleStartState } from "@/lib/battle/battle-setup";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { handlePostPlayCardDestination } from "@/lib/battle/card-consume";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { prepareTalentCardPlay } from "@/lib/battle/talent-card-play";
import { applyDodgeTalentStatuses } from "@/lib/battle/dodge-talent-rewards";
import { applyHealthThresholdCleanse, removeHarmfulPlayerStatuses } from "@/lib/battle/status-player";
import { applyLeechHitHealing } from "@/lib/battle/damage-rider-leech";
import { applyLifestealAndPlayerHitTriggers } from "@/lib/battle/follow-up-hit-resolution";
import { resolvePlayerHit } from "@/lib/battle/hit-resolution";
import { computeCardDamageToEnemy } from "@/lib/battle/damage-calc";
import { computeCardPayment } from "@/lib/battle/card-cost-rules";
import { tickPlayerStatuses } from "@/lib/battle/status-ticks";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { patchBattleState, type BattleStatePatch } from "../../fixtures/battle";
import { makeTestCard } from "../../fixtures/cards";

function talents(...names: string[]) {
  const unlocked: Partial<Record<KeywordId, string[]>> = {};
  for (const name of names) {
    const talent = talentPool.find((entry) => entry.name === name);
    if (!talent) throw new Error(`Unknown talent ${name}`);
    (unlocked[talent.keywordId] ??= []).push(talent.id);
  }
  return computeTalentEffects(unlocked);
}

function battle(patch: BattleStatePatch = {}) {
  return patchBattleState({
    enemyHealth: 100,
    enemyMaxHealth: 100,
    playerHealth: 10,
    playerMaxHealth: 40,
    mana: 10,
    maxMana: 10,
    rng: () => 0.99,
    ...patch,
  });
}

function play(state: ReturnType<typeof battle>, card: BattleCard) {
  return playBattleCardResolved({ ...state, hand: [...state.hand, card] }, card.id, state.hand.length).state;
}

const drawCard = makeTestCard({ id: "drawn", effects: [{ kind: "heal", amount: 1 }] });
const physical = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 4 }] });

function hit(state: ReturnType<typeof battle>, damageType: "physical" | "poison", amount = 4) {
  return resolvePlayerHit(
    state,
    { source: "card-attack", card: physical, effect: { kind: "damage", damageType, amount }, resolvedDamage: amount },
    [],
  );
}

describe("distinct talent conditions", () => {
  it("Unburdened cleanses both buildup types on every Dodge and rewards only a real cleanse", () => {
    const initial = battle({
      talentEffects: talents("Unburdened", "Divine Favor"),
      playerStatuses: { stun: 3, freeze: 4, burn: 5 },
    });
    const cleansed = applyDodgeTalentStatuses(initial, []);
    expect(cleansed.playerStatuses).toMatchObject({ stun: 0, freeze: 0, burn: 5 });
    expect(cleansed.flags.nextHolyCardFree).toBe(true);
    expect(initial.playerStatuses.stun).toBe(3);
    const empty = applyDodgeTalentStatuses(battle({ talentEffects: initial.talentEffects }), []);
    expect(empty.flags.nextHolyCardFree).toBe(false);
  });

  it("Iron Guard rewards Physical damage while Apothecary Membership discounts Potions", () => {
    const initial = battle({
      talentEffects: talents("Iron Guard", "Apothecary Membership"),
      flags: { playNextCardTwice: true },
      rng: () => 0,
    });
    const first = play(initial, cardById["stoneskin-potion"]!);
    expect(first.playerStatuses.armor).toBe(8);
    expect(initial.talentEffects.armorOnPhysicalDamageChance).toBe(10);
    const second = hit(first, "physical", 2);
    expect(second.playerStatuses.armor).toBe(10);
    const unmatched = play(battle({ talentEffects: initial.talentEffects }), cardById["heal"]!);
    expect(unmatched.playerStatuses).toMatchObject({ armor: 0, block: 0 });
  });

  it("Eagle Eye draws for each Archery play against Stunned enemies", () => {
    const initial = battle({
      talentEffects: talents("Eagle Eye"),
      enemyCC: { stunSkipTurns: 1 },
      deck: [drawCard, drawCard, drawCard],
    });
    const first = prepareTalentCardPlay(initial, cardById["fire-arrow"]!, []).state;
    expect(first.hand).toHaveLength(1);
    expect(prepareTalentCardPlay(first, cardById["fire-arrow"]!, []).state.hand).toHaveLength(2);
    expect(
      prepareTalentCardPlay(
        battle({ talentEffects: initial.talentEffects, deck: [drawCard] }),
        cardById["fire-arrow"]!,
        [],
      ).state.hand,
    ).toHaveLength(0);
  });

  it("Quickdraw and Venom Strike use their current damage and repeat contracts", () => {
    const effects = talents("Quickdraw", "Venom Strike");
    const matching = battle({ talentEffects: effects, enemyStatuses: { poison: 1 } });
    expect(prepareTalentCardPlay(matching, cardById["venom-arrow"]!, []).attackBonuses.physical).toBe(0);
    expect(
      prepareTalentCardPlay(
        battle({ talentEffects: effects, playerStatuses: { block: 1 } }),
        cardById["venom-arrow"]!,
        [],
      ).attackBonuses.physical,
    ).toBe(0);
    expect(effects.archeryDamageWithoutBlock).toBe(1);
    expect(effects.poisonCardPlayTwiceChance).toBe(10);
  });

  it("Wildfire repeats the current Burn card without a second roll", () => {
    let rolls = 0;
    const initial = battle({
      talentEffects: talents("Wildfire"),
      rng: () => (rolls++ === 0 ? 0 : 0.99),
    });
    const result = play(initial, cardById["fireball"]!);
    expect(result.enemyHealth).toBe(96);
  });

  it("Ecosystem tutors a Nature card before the opening hand", () => {
    const effects = talents("Ecosystem");
    const nature = makeTestCard({ id: "nature-drawn", tags: ["nature"] });
    const ordinary = makeTestCard({ id: "ordinary" });
    const next = createBattleStartState({
      runDeck: [ordinary, nature],
      currentEnemy: enemyBestiary[0]!,
      talentEffects: effects,
      rng: () => 0,
    });
    expect(next.hand.map((card) => card.id)).toEqual(["nature-drawn"]);
  });

  it("First Blood boosts only a hit starting without Bleed and can activate again after Bleed ends", () => {
    const initial = battle({ talentEffects: talents("First Blood") });
    const effect = { kind: "damage" as const, damageType: "bleed" as const, amount: 4 };
    expect(computeCardDamageToEnemy(initial, effect).modifiedDamage).toBe(5);
    expect(
      computeCardDamageToEnemy({ ...initial, enemyStatuses: { ...initial.enemyStatuses, bleed: 1 } }, effect)
        .modifiedDamage,
    ).toBe(4);
    expect(computeCardDamageToEnemy(initial, effect).modifiedDamage).toBe(5);
  });

  it("Finish Him doubles Physical damage below 25% enemy Health", () => {
    const effect = { kind: "damage" as const, damageType: "physical" as const, amount: 4 };
    const effects = talents("Finish Him");
    expect(computeCardDamageToEnemy(battle({ talentEffects: effects, enemyHealth: 24 }), effect).modifiedDamage).toBe(
      8,
    );
    expect(computeCardDamageToEnemy(battle({ talentEffects: effects, enemyHealth: 25 }), effect).modifiedDamage).toBe(
      4,
    );
  });

  it("Icebreaker gains Forge on each qualifying hit, after spending the previous Forge", () => {
    const initial = battle({ talentEffects: talents("Icebreaker"), enemyCC: { freezeSkipTurns: 1 } });
    const first = hit(initial, "physical");
    expect(first.playerStatuses.forge).toBe(1);
    expect(hit(first, "physical").playerStatuses.forge).toBe(1);
    expect(hit(battle({ talentEffects: initial.talentEffects }), "physical").playerStatuses.forge).toBe(0);
  });

  it("Hawk Eye prepares a Crit for the next attack", () => {
    const initial = battle({ talentEffects: talents("Hawk Eye"), flags: { hawkEyeReady: true } });
    const card = cardById["serrated-arrowhead"]!;
    const first = play(initial, card);
    expect(first.enemyHealth).toBe(96);
    expect(first.flags.hawkEyeReady).toBe(false);
    expect(play(first, card).enemyHealth).toBe(94);
  });

  it("Shatter adds generic damage and Snow Pack does not add a separate Freeze hit", () => {
    const shatter = play(
      battle({ talentEffects: talents("Shatter"), enemyCC: { freezeSkipTurns: 1 } }),
      makeTestCard({ cost: 0, effects: [{ kind: "damage", damageType: "physical", amount: 4 }] }),
    );
    expect(shatter.enemyHealth).toBe(95);

    const initial = battle({
      talentEffects: talents("Snow Pack"),
      activeCompanion: companionLibrary.skeleton,
      enemyCC: { freezeSkipTurns: 1 },
    });
    const next = processCompanionTurnStart(initial, []);
    expect(next.enemyHealth).toBe(98);
    expect(next.enemyStatuses.freeze).toBe(0);
    expect(
      processCompanionTurnStart(
        battle({ talentEffects: initial.talentEffects, activeCompanion: companionLibrary.skeleton }),
        [],
      ).enemyHealth,
    ).toBe(99);
  });

  it("Winter's Grasp repeats a Freeze card through the full-card pipeline", () => {
    let rolls = 0;
    const state = battle({
      talentEffects: talents("Winter's Grasp"),
      rng: () => (rolls++ === 0 ? 0 : 0.99),
    });
    expect(play(state, cardById["frostbolt"]!).enemyHealth).toBe(94);
  });

  it("Last Resort responds to a downward crossing, including ticks and Health costs", () => {
    const initial = battle({
      talentEffects: talents("Last Resort", "Divine Favor"),
      playerHealth: 10,
      playerStatuses: { burn: 2, poison: 3 },
    });
    expect(tickPlayerStatuses(initial, []).playerStatuses).toMatchObject({ burn: 0, poison: 0 });
    const paid = play(initial, cardById["blood-offering"]!);
    expect(paid.playerStatuses).toMatchObject({ burn: 0, poison: 0 });
    expect(paid.flags.nextHolyCardFree).toBe(true);
    expect(applyHealthThresholdCleanse(9, { ...initial, playerHealth: 8 }, []).playerStatuses.poison).toBe(3);
    expect(applyHealthThresholdCleanse(11, initial, []).playerStatuses.poison).toBe(3);
  });

  it("Desperate Siphon uses actual healing and the Health condition before healing", () => {
    const effects = talents("Desperate Siphon");
    expect(applyLeechHitHealing(battle({ talentEffects: effects, playerHealth: 19 }), 8, []).playerHealth).toBe(27);
    expect(applyLeechHitHealing(battle({ talentEffects: effects, playerHealth: 20 }), 8, []).playerHealth).toBe(24);
    expect(applyLeechHitHealing(battle({ talentEffects: effects, playerHealth: 5 }), 100, []).playerHealth).toBe(40);
    expect(applyLeechHitHealing(battle({ talentEffects: effects }), 0, []).playerHealth).toBe(10);
  });

  it.each(["physical", "nature", "holy"] as const)(
    "legacy Cull the Weak checks Health before a %s hit obtains Leech",
    (type) => {
      const initial = battle({
        enemyHealth: 53,
        talentEffects: { leechHolyDamageVsLowHealth: 1, natureLeechChance: 100 },
        trinketEffects: { brassCenserProcChance: type === "holy" ? 100 : 0 },
        rng: () => 0.75,
      });
      const effect = { kind: "damage" as const, damageType: type, amount: 4, lifesteal: type === "physical" };
      expect(
        resolvePlayerHit(initial, { source: "card-attack", card: physical, effect, resolvedDamage: 4 }, []).enemyHealth,
      ).toBe(49);
      expect(
        resolvePlayerHit(
          { ...initial, enemyHealth: 49 },
          { source: "card-attack", card: physical, effect, resolvedDamage: 4 },
          [],
        ).enemyHealth,
      ).toBe(44);
    },
  );

  it("legacy Cull the Weak adds Holy damage without recursively triggering another Leech hit", () => {
    const effects = { ...talents("Blessed Leech"), leechHolyDamageVsLowHealth: 1 };
    const initial = battle({ talentEffects: effects, enemyHealth: 49 });
    expect(applyLifestealAndPlayerHitTriggers(initial, 8, []).enemyHealth).toBe(48);
    expect(
      applyLifestealAndPlayerHitTriggers(battle({ talentEffects: effects, enemyHealth: 50 }), 8, []).enemyHealth,
    ).toBe(50);
  });
});

describe("repeatable card and Consume rewards", () => {
  it("Whistle acts after summoning and after Pack Tactics, once even when the card repeats", () => {
    const effects = talents("Whistle", "Hunter's Bond", "Last Supper", "Second Helping");
    const first = play(
      battle({ talentEffects: effects, deck: [drawCard, drawCard, drawCard] }),
      cardById["wolf-companion"]!,
    );
    expect(first.enemyHealth).toBe(99);
    expect(first.playerStatuses.block).toBe(0);
    expect(first.playerStatuses.forge).toBe(0);
    expect(first.hand).toHaveLength(1);
    const second = play({ ...first, flags: { ...first.flags, playNextCardTwice: true } }, cardById["pack-tactics"]!);
    expect(second.companionDamageBuff).toBe(0);
    expect(second.enemyHealth).toBe(94);
    expect(second.playerStatuses.block).toBe(0);
    expect(second.hand).toHaveLength(2);
  });

  it("Consume rewards distinguish the last held card from ordinary consumption", () => {
    const initial = battle({
      talentEffects: talents("Last Supper", "Second Helping", "Rotgut", "Combustible"),
      enemyStatuses: { burn: 3 },
      deck: [drawCard, drawCard, drawCard],
      rng: () => 0,
    });
    const first = handlePostPlayCardDestination(initial, cardById["health-potion"]!, { lastCardInHand: true });
    expect(first.enemyHealth).toBe(97);
    expect(first.enemyStatuses).toMatchObject({ burn: 0, poison: 0 });
    expect(first.playerStatuses.forge).toBe(3);
    expect(first.hand).toHaveLength(1);
    const second = handlePostPlayCardDestination(first, cardById["health-potion"]!);
    expect(second.enemyHealth).toBe(97);
    expect(second.playerStatuses.forge).toBe(3);
    expect(second.hand).toHaveLength(2);
  });

  it("Divine Favor survives a save, pays for one Holy card, and can be readied again", () => {
    const initial = battle({ talentEffects: talents("Divine Favor"), playerStatuses: { burn: 2 }, mana: 0 });
    const cleansed = removeHarmfulPlayerStatuses(initial, 1, []);
    const resumed = { ...PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(cleansed))), rng: () => 0.99 };
    const card = cardById["holy-radiance"]!;
    expect(computeCardPayment(resumed, card)).toMatchObject({ affordable: true, effectiveCost: 0 });
    expect(computeCardPayment(resumed, physical)).toMatchObject({ affordable: false, effectiveCost: 1 });
    const played = play(resumed, card);
    expect(played.flags.nextHolyCardFree).toBe(false);
    expect(computeCardPayment(played, card)).toMatchObject({ affordable: false, effectiveCost: 1 });
    expect(
      removeHarmfulPlayerStatuses({ ...played, playerStatuses: { ...played.playerStatuses, bleed: 1 } }, 1, []).flags
        .nextHolyCardFree,
    ).toBe(true);
  });

  it("a cleansing Companion can ready Divine Favor without consuming it", () => {
    const initial = battle({
      talentEffects: talents("Divine Favor"),
      activeCompanion: companionLibrary["will-o-wisp"],
      playerStatuses: { poison: 1 },
    });
    expect(processCompanionTurnStart(initial, []).flags.nextHolyCardFree).toBe(true);
  });
});
