import { getEffectiveDamageScore } from "@/lib/battle/autoplay-policy";
import { describe, expect, it } from "vitest";
import { cardById, BattleCardEffectSchema, type BattleCard } from "@/lib/game-data";
import { repeatUniqueCardDamage } from "@/lib/battle/unique-card-effects";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { getEnemyAbilityPressure } from "@/lib/battle/battle-enemy-setup";
import { applyNumericCorruption, getEditableCorruptionTargets } from "@/lib/corruption/numeric";
import { validateCardDescriptionParity } from "@/lib/content-validation/card-parity";
import { hydrateCard, cloneBattleCard } from "@/lib/game-data/cards/hydrate-card";
import { BattleCardSchema } from "@/lib/validation/save-schemas/battle-card-schemas";
import { patchBattleState, type BattleStatePatch } from "../../fixtures/battle";

const battle = (patch: BattleStatePatch = {}) =>
  patchBattleState({
    enemyHealth: 100,
    enemyMaxHealth: 100,
    playerHealth: 100,
    playerMaxHealth: 100,
    appliesFightPacing: false,
    rng: () => 0.99,
    ...patch,
  });

function sequenceRng(values: number[]) {
  let index = 0;
  return () => values[index++] ?? 0.99;
}

function play(id: string, patch: BattleStatePatch = {}) {
  const card = cardById[id]!;
  return playBattleCardResolved(battle({ ...patch, hand: [card] }), id, 0);
}

describe("strategic cards", () => {
  it.each([0, 1, 2, 3, 6])("Shield Bash gains Block before spending half of it (%i)", (block) => {
    const result = play("shield-bash", { playerStatuses: { block } });
    expect(validateCardDescriptionParity(cardById["shield-bash"]!)).toEqual([]);
    expect(result.state.enemyHealth).toBe(100 - Math.round((block + 2) / 2));
    expect(result.state.playerStatuses.block).toBe(block + 2 - Math.round((block + 2) / 2));
    expect(result.combatTexts).toContainEqual(
      expect.objectContaining({
        kind: "damage",
        stat: "block",
        amount: Math.round((block + 2) / 2),
        impact: false,
        feedback: "secondary",
      }),
    );
  });
  it("a real second card resolution uses the newly gained Block again", () => {
    const result = play("shield-bash", { playerStatuses: { block: 3 }, flags: { playNextCardTwice: true } });
    expect(result.state.enemyHealth).toBe(95);
    expect(result.state.playerStatuses.block).toBe(2);
  });

  it("spends five of ten Block in the approved eight-Block example", () => {
    const result = play("shield-bash", { playerStatuses: { block: 8 } });
    expect(result.state.playerStatuses.block).toBe(5);
    expect(result.state.enemyHealth).toBe(95);
  });
  it("applies the modified Block grant before spending and ordinary damage bonuses once", () => {
    const result = play("shield-bash", {
      playerStatuses: { block: 12, forge: 20 },
      talentEffects: { forgeBlockPercent: 25, blockStunDamagePercent: 10 },
      gearEffects: { flatBlockGained: 2, flatStunDamage: 3 },
    });
    // Gain9, spend11 of21, retain10;11+20Forge+3flat+1from retainedBlock.
    expect(result.state.playerStatuses.block).toBe(10);
    expect(result.state.enemyHealth).toBe(65);
  });
  it("pays Block even when the hit is dodged or fully mitigated", () => {
    for (const patch of [{ rng: () => 0 }, { enemyMitigation: { block: 100, armor: 100 } }]) {
      const result = play("shield-bash", { playerStatuses: { block: 8 }, ...patch });
      expect(result.state.playerStatuses.block).toBe(5);
      expect(result.state.enemyHealth).toBe(100);
    }
  });
  it("a critical changes the hit, never its Block cost", () => {
    const result = play("shield-bash", { playerStatuses: { block: 8 }, flags: { nextHitCrit: true } });
    expect(result.state.playerStatuses.block).toBe(5);
    expect(result.state.enemyHealth).toBe(90);
  });
  it.each([0, 1, 5])("spends only actual available Block, including depletion (%i)", (block) => {
    const source = cardById["shield-bash"]!;
    const spendOnly = { ...source, effects: [source.effects[1]!] };
    const texts: Array<import("@/lib/battle").CombatTextEvent> = [];
    const result = applyCardEffects(
      battle({ playerHealth: 50, playerStatuses: { block }, talentEffects: { blockDepletedHeal: 2 } }),
      spendOnly,
      texts,
    );
    expect(result.playerStatuses.block).toBe(block - Math.round(block / 2));
    expect(result.enemyHealth).toBe(100 - Math.round(block / 2));
    expect(result.playerHealth).toBe(block === 1 ? 52 : 50);
  });
  it("keeps non-spending Block scaling and saved effects unchanged", () => {
    const source = cardById["shield-bash"]!;
    const card = {
      ...source,
      effects: [{ kind: "damage", damageType: "holy", amount: 0, equalToBlock: true, equalToBlockPercent: 50 }],
    } as BattleCard;
    const result = applyCardEffects(battle({ playerStatuses: { block: 5 } }), card, []);
    expect(result.playerStatuses.block).toBe(5);
    expect(result.enemyHealth).toBe(97);
    expect(
      BattleCardEffectSchema.safeParse({ kind: "damage", damageType: "stun", amount: 0, spendBlock: true }).success,
    ).toBe(false);
  });

  it("recorded hit echoes reuse the paid amount without spending Block again", () => {
    const source = cardById["shield-bash"]!;
    const damageEffects: Array<Extract<import("@/lib/game-data").BattleCardEffect, { kind: "damage" }>> = [];
    const texts: Array<import("@/lib/battle").CombatTextEvent> = [];
    const first = applyCardEffects(battle({ playerStatuses: { block: 8 } }), source, texts, {
      manaAtStart: 3,
      damageEffects,
    });
    expect(damageEffects).toEqual([{ kind: "damage", damageType: "stun", amount: 5 }]);
    const echoed = repeatUniqueCardDamage(first, { ...source, effects: damageEffects }, texts);
    expect(echoed.playerStatuses.block).toBe(5);
    expect(echoed.enemyHealth).toBe(90);
  });

  it("rejected plays do not spend Block", () => {
    const result = play("shield-bash", { mana: 0, playerStatuses: { block: 5 } });
    expect(result.state.playerStatuses.block).toBe(5);
    expect(result.state.enemyHealth).toBe(100);
  });
  it.each([
    [0, "bleed"],
    [0.99, "stun"],
  ] as const)("Maul chooses one random damage type (%i)", (roll, status) => {
    const result = play("maul", {
      enemyMitigation: { block: 0 },
      enemyStatuses: { poison: 1 },
      talentEffects: { poisonPreventsEnemyDodge: true },
      rng: sequenceRng([roll, 0.99, 0.99]),
    });
    const hit = result.combatTexts.find((event) => event.kind === "damage" && event.stat !== "block");
    expect(hit?.stat).toBe(status);
    expect(result.state.enemyHealth).toBe(97);
    expect(result.state.enemyMitigation.block).toBe(0);
  });
  it.each([false, true])("Ice Shot uses pre-hit Frozen without clearing it (%s)", (frozen) => {
    const result = play("ice-shot", {
      enemyCC: { freezeSkipTurns: frozen ? 1 : 0 },
      enemyStatuses: { freeze: frozen ? 0 : 34 },
    });
    expect(result.combatTexts.find((event) => event.kind === "damage")?.stat).toBe("freeze");
    expect(result.state.enemyHealth).toBe(frozen ? 96 : 98);
    expect(result.state.flags.nextArcheryCardFree).toBe(false);
    if (frozen) expect(result.state.enemyCC.freezeSkipTurns).toBe(1);
  });
  it("Ice Shot still spends an existing free-Archery preparation and uses the selected modifiers", () => {
    const result = play("ice-shot", {
      mana: 1,
      flags: { nextArcheryCardFree: true },
      enemyCC: { freezeSkipTurns: 1 },
      talentEffects: { flatPhysicalDamage: 2, flatFreezeDamage: 20 },
    });
    expect(result.state.mana).toBe(1);
    expect(result.state.flags.nextArcheryCardFree).toBe(false);
    expect(result.state.enemyHealth).toBe(76);
  });
  it("state-aware autoplay quotes the selected base damage without spending resources", () => {
    const state = battle({ playerStatuses: { block: 2 }, enemyCC: { freezeSkipTurns: 1 } });
    expect(getEffectiveDamageScore(cardById["shield-bash"]!, state)).toBe(2);
    expect(getEffectiveDamageScore(cardById["ice-shot"]!, state)).toBe(4);
    expect(state.playerStatuses.block).toBe(2);
  });
  it("enemies gain Block before resolving Shield Bash", () => {
    for (const [id, patch, expected] of [
      ["shield-bash", { enemyMitigation: { block: 2 } }, 2],
      ["maul", { playerStatuses: { block: 1 } }, 2],
      ["ice-shot", { playerCC: { freezeSkipTurns: 1 } }, 4],
    ] as const) {
      const base = battle(patch);
      const state = applyEnemyAbility(
        {
          ...base,
          difficultyModifiers: [{ kind: "enemy-damage-multiplier", amount: 1 / getEnemyAbilityPressure(base) }],
        },
        cardById[id]!,
        [],
      );
      expect(state.playerHealth).toBe(100 - expected);
      if (id === "shield-bash") expect(state.enemyMitigation.block).toBe(2);
      if (id === "ice-shot") expect(state.playerCC.freezeSkipTurns).toBe(1);
    }
  });
  it("upgrades damage fields and shared Maul numbers", () => {
    for (const id of ["maul", "ice-shot"]) {
      const original = cardById[id]!;
      const json = JSON.stringify(original);
      let card = cloneBattleCard(original);
      expect(getEditableCorruptionTargets(card).map((entry) => entry.field)).toEqual(["amount"]);
      for (let step = 0; step < 4; step += 1) {
        const targets = getEditableCorruptionTargets(card);
        card = applyNumericCorruption(card, targets[step % targets.length]!, step === 0 ? -1 : 1);
        expect(validateCardDescriptionParity(card)).toEqual([]);
        expect(hydrateCard(BattleCardSchema.parse(JSON.parse(JSON.stringify(card))))).toMatchObject({
          effects: card.effects,
          descriptionLines: card.descriptionLines,
        });
      }
      expect(JSON.stringify(original)).toBe(json);
    }
  });

  it("chance-based damage still upgrades and resolves both branches", () => {
    const legacy: BattleCard = {
      ...cardById.maul!,
      descriptionLines: ["50% chance: Deal 3 Stun damage", "Otherwise: Deal 3 Bleed damage"],
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [{ kind: "damage", damageType: "stun", amount: 3 }],
          failureEffects: [{ kind: "damage", damageType: "bleed", amount: 3 }],
        },
      ],
    };
    const restored = hydrateCard(BattleCardSchema.parse(JSON.parse(JSON.stringify(legacy))));
    const first = applyNumericCorruption(restored, getEditableCorruptionTargets(restored)[0]!, 1);
    const changed = applyNumericCorruption(first, getEditableCorruptionTargets(first)[1]!, 1);
    expect(changed.effects[0]).toMatchObject({ successEffects: [{ amount: 4 }], failureEffects: [{ amount: 4 }] });
    expect(validateCardDescriptionParity(changed)).toEqual([]);
    const texts: Array<import("@/lib/battle").CombatTextEvent> = [];
    applyCardEffects(battle(), restored, texts);
    expect(texts.find((event) => event.kind === "damage")?.stat).toBe("bleed");
  });

  it("preserves complete legacy saved cards", () => {
    const legacy: BattleCard = {
      ...cardById["shield-bash"]!,
      descriptionLines: ["Deal 2 Stun damage", "Gain 2 Block"],
      effects: [
        { kind: "damage", damageType: "stun", amount: 2 },
        { kind: "player-status", status: "block", amount: 2 },
      ],
    };
    const saved = hydrateCard(BattleCardSchema.parse(JSON.parse(JSON.stringify(legacy))));
    const result = applyCardEffects(battle(), saved, []);
    expect(saved.effects).toEqual(legacy.effects);
    expect(result.playerStatuses.block).toBe(2);
    expect(result.enemyHealth).toBe(98);
    expect(
      BattleCardEffectSchema.safeParse({ kind: "damage", damageType: "stun", amount: 2, blockCost: 2 }).success,
    ).toBe(false);
  });
});
