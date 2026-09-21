import { getEffectiveDamageScore } from "@/lib/battle/autoplay-policy";
import { describe, expect, it } from "vitest";
import { cardById, BattleCardEffectSchema, type BattleCard } from "@/lib/game-data";
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
  it.each([0, 1, 2, 3, 6])("Shield Bash gains Block before dealing half of it (%i)", (block) => {
    const result = play("shield-bash", { playerStatuses: { block } });
    expect(result.state.enemyHealth).toBe(100 - Math.round((block + 2) / 2));
    expect(result.state.playerStatuses.block).toBe(block + 2);
    expect(result.combatTexts.some((event) => event.kind === "damage" && event.stat === "block")).toBe(false);
  });
  it("a real second card resolution uses the newly gained Block again", () => {
    const result = play("shield-bash", { playerStatuses: { block: 3 }, flags: { playNextCardTwice: true } });
    expect(result.state.enemyHealth).toBe(93);
    expect(result.state.playerStatuses.block).toBe(7);
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
      if (id === "shield-bash") expect(state.enemyMitigation.block).toBe(4);
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

  it("legacy saved chance-based Maul still upgrades and resolves both branches", () => {
    const legacy: BattleCard = {
      ...cardById.maul!,
      descriptionLines: ["Deal 3 Stun or Bleed damage at random"],
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
    const changed = applyNumericCorruption(restored, getEditableCorruptionTargets(restored)[0]!, 1);
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
