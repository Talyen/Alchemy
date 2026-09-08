import { describe, expect, it } from "vitest";
import {
  cardById,
  companionLibrary,
  computeTalentEffects,
  talentPool,
  type BattleCard,
  type KeywordId,
} from "@/lib/game-data";
import { playBattleCardResolved, handlePostPlayCardDestination } from "@/lib/battle/card-play";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { prepareTalentCardPlay } from "@/lib/battle/talent-card-play";
import { applyDodgeTalentStatuses } from "@/lib/battle/dodge-talent-rewards";
import { applyHealthThresholdCleanse, removeHarmfulPlayerStatuses } from "@/lib/battle/status-player";
import { applyLeechHealing } from "@/lib/battle/damage-rider-leech";
import { applyLifestealAndPlayerHitTriggers } from "@/lib/battle/player-typed-hit";
import { applyDamageRiders } from "@/lib/battle/damage-riders";
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
  return applyDamageRiders(state, physical, { kind: "damage", damageType, amount }, amount, []);
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

  it("Iron Guard and Apothecary’s Guard reward each matching play, not repeated effects", () => {
    const initial = battle({
      talentEffects: talents("Iron Guard", "Apothecary’s Guard"),
      flags: { playNextCardTwice: true },
    });
    const first = play(initial, cardById["stoneskin-potion"]!);
    expect(first.playerStatuses).toMatchObject({ armor: 9, block: 2 });
    const second = play(first, cardById["plate-mail"]!);
    expect(second.playerStatuses).toMatchObject({ armor: 11, block: 4 });
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

  it("Quickdraw and Venom Strike prepare separate Physical damage under their own conditions", () => {
    const effects = talents("Quickdraw", "Venom Strike");
    const matching = battle({ talentEffects: effects, enemyStatuses: { poison: 1 } });
    expect(prepareTalentCardPlay(matching, cardById["venom-arrow"]!, []).attackBonuses.physical).toBe(2);
    expect(
      prepareTalentCardPlay(
        battle({ talentEffects: effects, playerStatuses: { block: 1 } }),
        cardById["venom-arrow"]!,
        [],
      ).attackBonuses.physical,
    ).toBe(0);
  });

  it("Wildfire only deals Poison damage when it removes Poison and readies Divine Favor on a full cleanse", () => {
    const initial = battle({ talentEffects: talents("Wildfire", "Divine Favor"), playerStatuses: { poison: 2 } });
    const first = prepareTalentCardPlay(initial, cardById["fireball"]!, []).state;
    expect(first.playerStatuses.poison).toBe(1);
    expect(first.enemyHealth).toBe(99);
    expect(first.flags.nextHolyCardFree).toBe(false);
    const second = prepareTalentCardPlay(first, cardById["fireball"]!, []).state;
    expect(second.enemyHealth).toBe(98);
    expect(second.playerStatuses.poison).toBe(0);
    expect(second.flags.nextHolyCardFree).toBe(true);
    expect(prepareTalentCardPlay(second, cardById["fireball"]!, []).state.enemyHealth).toBe(98);
  });

  it("Ecosystem requires existing Poison and deals typed damage on each Nature play", () => {
    const effects = talents("Ecosystem");
    const initial = battle({ talentEffects: effects, enemyStatuses: { poison: 2 } });
    const next = prepareTalentCardPlay(initial, cardById["lightning-bolt"]!, []).state;
    expect(next.enemyHealth).toBe(99);
    expect(next.enemyStatuses.poison).toBe(3);
    expect(
      prepareTalentCardPlay(battle({ talentEffects: effects }), cardById["lightning-bolt"]!, []).state.enemyHealth,
    ).toBe(100);
  });

  it("First Blood boosts only a hit starting without Bleed and can activate again after Bleed ends", () => {
    const initial = battle({ talentEffects: talents("First Blood") });
    const effect = { kind: "damage" as const, damageType: "bleed" as const, amount: 4 };
    expect(computeCardDamageToEnemy(initial, effect).modifiedDamage).toBe(6);
    expect(
      computeCardDamageToEnemy({ ...initial, enemyStatuses: { ...initial.enemyStatuses, bleed: 1 } }, effect)
        .modifiedDamage,
    ).toBe(4);
    expect(computeCardDamageToEnemy(initial, effect).modifiedDamage).toBe(6);
  });

  it("Finish Him gives a Physical hit Leech only against a previously Stunned enemy", () => {
    const initial = battle({ talentEffects: talents("Finish Him"), enemyCC: { stunSkipTurns: 1 } });
    expect(hit(initial, "physical").playerHealth).toBe(12);
    expect(hit(battle({ talentEffects: initial.talentEffects }), "physical").playerHealth).toBe(10);
  });

  it("Icebreaker gains Forge on each qualifying hit, after spending the previous Forge", () => {
    const initial = battle({ talentEffects: talents("Icebreaker"), enemyCC: { freezeSkipTurns: 1 } });
    const first = hit(initial, "physical");
    expect(first.playerStatuses.forge).toBe(1);
    expect(hit(first, "physical").playerStatuses.forge).toBe(1);
    expect(hit(battle({ talentEffects: initial.talentEffects }), "physical").playerStatuses.forge).toBe(0);
  });

  it("Hawk Eye adds Holy hits only against Frozen enemies", () => {
    const initial = battle({ talentEffects: talents("Hawk Eye"), enemyCC: { freezeSkipTurns: 1 } });
    const card = cardById["serrated-arrowhead"]!;
    const effect = { kind: "damage" as const, damageType: "bleed" as const, amount: 3 };
    expect(applyDamageRiders(initial, card, effect, 3, []).enemyHealth).toBe(95);
    expect(applyDamageRiders(battle({ talentEffects: initial.talentEffects }), card, effect, 3, []).enemyHealth).toBe(
      97,
    );
  });

  it("Snow Pack adds Freeze damage to a Companion hit rather than increasing its original type", () => {
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
    expect(applyLeechHealing(battle({ talentEffects: effects, playerHealth: 19 }), 8, []).playerStatuses.block).toBe(4);
    expect(applyLeechHealing(battle({ talentEffects: effects, playerHealth: 20 }), 8, []).playerStatuses.block).toBe(0);
    expect(applyLeechHealing(battle({ talentEffects: effects, playerHealth: 5 }), 100, []).playerStatuses.block).toBe(
      18,
    );
    expect(applyLeechHealing(battle({ talentEffects: effects }), 0, []).playerStatuses.block).toBe(0);
  });

  it.each(["physical", "nature", "holy"] as const)(
    "Cull the Weak checks Health before a %s hit obtains Leech",
    (type) => {
      const initial = battle({
        enemyHealth: 53,
        talentEffects: { ...talents("Cull the Weak"), natureLeechChance: 100 },
        trinketEffects: { brassCenserProcChance: type === "holy" ? 100 : 0 },
        rng: () => 0.75,
      });
      const effect = { kind: "damage" as const, damageType: type, amount: 4, lifesteal: type === "physical" };
      expect(applyDamageRiders(initial, physical, effect, 4, []).enemyHealth).toBe(49);
      expect(applyDamageRiders({ ...initial, enemyHealth: 49 }, physical, effect, 4, []).enemyHealth).toBe(44);
    },
  );

  it("Cull the Weak adds Holy damage without recursively triggering another Leech hit", () => {
    const effects = talents("Cull the Weak", "Blessed Leech");
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
    expect(first.playerStatuses.block).toBe(1);
    expect(first.playerStatuses.forge).toBe(0);
    expect(first.hand).toHaveLength(1);
    const second = play({ ...first, flags: { ...first.flags, playNextCardTwice: true } }, cardById["pack-tactics"]!);
    expect(second.companionDamageBuff).toBe(2);
    expect(second.enemyHealth).toBe(90);
    expect(second.playerStatuses.block).toBe(2);
    expect(second.hand).toHaveLength(2);
  });

  it("Last Supper, Second Helping, Rotgut, and Combustible reward every consumed card", () => {
    const initial = battle({
      talentEffects: talents("Last Supper", "Second Helping", "Rotgut", "Combustible"),
      enemyStatuses: { burn: 3 },
      deck: [drawCard, drawCard, drawCard],
    });
    const first = handlePostPlayCardDestination(initial, cardById["health-potion"]!, true, []);
    expect(first.enemyHealth).toBe(96);
    expect(first.enemyStatuses).toMatchObject({ burn: 0, poison: 1 });
    expect(first.playerStatuses.forge).toBe(1);
    expect(first.hand).toHaveLength(1);
    const second = handlePostPlayCardDestination(first, cardById["health-potion"]!, true, []);
    expect(second.enemyHealth).toBe(95);
    expect(second.playerStatuses.forge).toBe(2);
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
