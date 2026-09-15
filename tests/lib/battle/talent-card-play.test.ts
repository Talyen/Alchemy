import { describe, expect, it } from "vitest";
import { prepareTalentCardPlay } from "@/lib/battle/talent-card-play";
import { makeCombatTexts, makeEffect, makeTestCard, patchBattleState, slashDeck } from "../../fixtures/battle";
import { defaultCcState } from "../../fixtures/default-battle-state";

const talents = (overrides = {}) => ({ ...patchBattleState().talentEffects, ...overrides });
const attackCard = (overrides = {}) => makeTestCard({ effects: [makeEffect("physical", 6)], ...overrides });

describe("prepareTalentCardPlay attack bonuses", () => {
  it("grants consecutive-archery damage after an archery card", () => {
    const state = patchBattleState({
      talentEffects: talents({ consecutiveArcheryPhysicalDamage: 3 }),
      flags: { previousCardWasArchery: true },
    });
    const card = attackCard({ tags: ["archery"] });
    const result = prepareTalentCardPlay(state, card, makeCombatTexts());
    expect(result.attackBonuses.physical).toBe(3);
    expect(result.state.flags.previousCardWasArchery).toBe(true);
  });

  it("grants archery-without-block damage only at zero block", () => {
    const card = attackCard({ tags: ["archery"] });
    const exposed = patchBattleState({
      talentEffects: talents({ archeryPhysicalWithoutBlock: 2 }),
      playerStatuses: { block: 0 },
    });
    expect(prepareTalentCardPlay(exposed, card, makeCombatTexts()).attackBonuses.physical).toBe(2);
    const guarded = patchBattleState({
      talentEffects: talents({ archeryPhysicalWithoutBlock: 2 }),
      playerStatuses: { block: 5 },
    });
    expect(prepareTalentCardPlay(guarded, card, makeCombatTexts()).attackBonuses.physical).toBe(0);
  });

  it("grants poison-card damage only against a poisoned enemy", () => {
    const card = attackCard({ tags: ["poison"] });
    const poisoned = patchBattleState({
      talentEffects: talents({ poisonCardPhysicalVsPoisoned: 4 }),
      enemyStatuses: { poison: 3 },
    });
    expect(prepareTalentCardPlay(poisoned, card, makeCombatTexts()).attackBonuses.physical).toBe(4);
    const clean = patchBattleState({ talentEffects: talents({ poisonCardPhysicalVsPoisoned: 4 }) });
    expect(prepareTalentCardPlay(clean, card, makeCombatTexts()).attackBonuses.physical).toBe(0);
  });

  it("grants bleed after nature only to physical cards following nature", () => {
    const state = patchBattleState({
      talentEffects: talents({ physicalAfterNatureBleedDamage: 5 }),
      flags: { previousCardWasNature: true },
    });
    const physical = prepareTalentCardPlay(state, attackCard(), makeCombatTexts());
    expect(physical.attackBonuses.bleed).toBe(5);
    const burn = prepareTalentCardPlay(state, makeTestCard({ effects: [makeEffect("burn", 6)] }), makeCombatTexts());
    expect(burn.attackBonuses.bleed).toBe(0);
  });

  it("carries sanguine bonus only on attacks", () => {
    const state = patchBattleState({ flags: { sanguinePhysicalBonus: 7 } });
    const texts = makeCombatTexts();
    expect(prepareTalentCardPlay(state, attackCard(), texts).attackBonuses.sanguine).toBe(7);
    const blockCard = makeTestCard({
      effects: [{ kind: "player-status", status: "block", amount: 5 }],
    });
    expect(prepareTalentCardPlay(state, blockCard, texts).attackBonuses.sanguine).toBe(0);
  });

  it("banks companion bonus on physical cards and tracks last-card keywords", () => {
    const state = patchBattleState({ talentEffects: talents({ companionNextAttackOnPhysical: 2 }) });
    const result = prepareTalentCardPlay(state, attackCard(), makeCombatTexts());
    expect(result.state.flags.companionNextAttackBonus).toBe(2);
    expect(result.state.flags.previousCardWasArchery).toBe(false);
    const nature = prepareTalentCardPlay(
      state,
      makeTestCard({ tags: ["nature"], effects: [makeEffect("nature", 4)] }),
      makeCombatTexts(),
    );
    expect(nature.state.flags.previousCardWasNature).toBe(true);
  });
});

describe("prepareTalentCardPlay triggers", () => {
  it("draws against a stunned enemy for archery cards", () => {
    const base = patchBattleState({
      talentEffects: talents({ drawOnArcheryVsStunned: 1 }),
      enemyCC: defaultCcState({ stunSkipTurns: 1 }),
      deck: slashDeck(3),
    });
    const handSize = base.hand.length;
    const result = prepareTalentCardPlay(base, attackCard({ tags: ["archery"] }), makeCombatTexts());
    expect(result.state.hand.length).toBeGreaterThan(handSize);
  });

  it("partially cleanses poison on burn cards without killing the stack accounting", () => {
    const state = patchBattleState({
      talentEffects: talents({ cleansePoisonOnBurnCard: 3 }),
      playerStatuses: { poison: 5 },
    });
    const card = makeTestCard({ tags: ["burn"], effects: [makeEffect("burn", 6)] });
    const result = prepareTalentCardPlay(state, card, makeCombatTexts());
    expect(result.state.playerStatuses.poison).toBe(2);
  });

  it("caps armor steal on leech cards at remaining enemy armor", () => {
    const state = patchBattleState({
      talentEffects: talents({ armorStealOnLeechCard: 5 }),
      enemyMitigation: { armor: 1, block: 0, forge: 0 },
    });
    const card = makeTestCard({ tags: ["leech"], effects: [makeEffect("physical", 4)] });
    const result = prepareTalentCardPlay(state, card, makeCombatTexts());
    expect(result.state.enemyMitigation.armor).toBe(0);
  });
});
