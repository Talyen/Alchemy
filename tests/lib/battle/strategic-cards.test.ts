import { getEffectiveDamageScore } from "@/lib/battle/autoplay-policy";
import { describe, expect, it } from "vitest";
import { cardById, BattleCardEffectSchema, type BattleCard } from "@/lib/game-data";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { getEnemyAbilityPressure } from "@/lib/battle/battle-enemy-setup";
import { resolveConditionalCardDamage } from "@/lib/battle/conditional-card-damage";
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
function play(id: string, patch: BattleStatePatch = {}) {
  const card = cardById[id]!;
  return playBattleCardResolved(battle({ ...patch, hand: [card] }), id, 0);
}

describe("strategic cards", () => {
  it.each([0, 1, 2, 6])("Shield Bash spends exactly two available Block (%i)", (block) => {
    const result = play("shield-bash", { playerStatuses: { block } });
    expect(result.state.enemyHealth).toBe(100 - (block >= 2 ? 5 : 2));
    expect(result.state.playerStatuses.block).toBe(block >= 2 ? block - 2 : block);
    expect(result.combatTexts.some((event) => event.kind === "damage" && event.stat === "block")).toBe(block >= 2);
  });
  it("a real second card resolution reevaluates optional Block payment", () => {
    const result = play("shield-bash", { playerStatuses: { block: 3 }, flags: { playNextCardTwice: true } });
    expect(result.state.enemyHealth).toBe(93);
    expect(result.state.playerStatuses.block).toBe(1);
  });

  it("rejected plays do not spend Block", () => {
    const result = play("shield-bash", { mana: 0, playerStatuses: { block: 5 } });
    expect(result.state.playerStatuses.block).toBe(5);
    expect(result.state.enemyHealth).toBe(100);
  });
  it.each([0, 1, 8])("Maul selects its type before consuming target Block (%i)", (block) => {
    const result = play("maul", { enemyMitigation: { block }, playerStatuses: { forge: 2 } });
    const hit = result.combatTexts.find((event) => event.kind === "damage" && event.stat !== "block");
    if (block < 5) expect(hit?.stat).toBe(block > 0 ? "stun" : "bleed");
    else expect(result.state.enemyMitigation.block).toBe(block - 5);
    expect(result.state.enemyHealth).toBe(100 - Math.max(0, (block > 0 ? 5 : 3) - block));
  });
  it.each([false, true])("Ice Shot uses pre-hit Frozen without clearing it (%s)", (frozen) => {
    const result = play("ice-shot", {
      enemyCC: { freezeSkipTurns: frozen ? 1 : 0 },
      enemyStatuses: { freeze: frozen ? 0 : 34 },
    });
    expect(result.combatTexts.find((event) => event.kind === "damage")?.stat).toBe(frozen ? "physical" : "freeze");
    expect(result.state.enemyHealth).toBe(frozen ? 95 : 98);
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
    expect(result.state.enemyHealth).toBe(93);
  });
  it("state-aware autoplay quotes the selected base damage without spending resources", () => {
    const state = battle({ playerStatuses: { block: 2 }, enemyCC: { freezeSkipTurns: 1 } });
    expect(getEffectiveDamageScore(cardById["shield-bash"]!, state)).toBe(5);
    expect(getEffectiveDamageScore(cardById["ice-shot"]!, state)).toBe(5);
    expect(state.playerStatuses.block).toBe(2);
  });
  it("selection is deterministic and resolved packets cannot spend Block again", () => {
    const effect = cardById["shield-bash"]!.effects[0]!;
    if (effect.kind !== "damage") throw new Error("Expected damage");
    const resources = { actorBlock: 4, targetBlock: 0, targetFrozen: false };
    const selected = resolveConditionalCardDamage(effect, resources);
    expect(selected).toMatchObject({ blockSpent: 2, effect: { amount: 5, damageType: "stun" } });
    expect(resolveConditionalCardDamage(selected.effect, resources).blockSpent).toBe(0);
  });
  it("enemies pay from their own Block and inspect the player's defenses and Frozen", () => {
    for (const [id, patch, expected] of [
      ["shield-bash", { enemyMitigation: { block: 2 } }, 5],
      ["maul", { playerStatuses: { block: 1 } }, 2],
      ["ice-shot", { playerCC: { freezeSkipTurns: 1 } }, 5],
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
      if (id === "shield-bash") expect(state.enemyMitigation.block).toBe(0);
      if (id === "ice-shot") expect(state.playerCC.freezeSkipTurns).toBe(1);
    }
  });
  it("upgrades damage fields and shared Maul numbers without corrupting the Block cost", () => {
    for (const id of ["shield-bash", "maul", "ice-shot"]) {
      const original = cardById[id]!;
      const json = JSON.stringify(original);
      let card = cloneBattleCard(original);
      expect(getEditableCorruptionTargets(card).map((entry) => entry.field)).toEqual(
        id === "shield-bash"
          ? ["amount", "blockDamageBonus"]
          : id === "ice-shot"
            ? ["amount", "amountIfTargetFrozen"]
            : ["amount"],
      );
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
      if (id === "shield-bash") expect(card.effects[0]).toMatchObject({ blockCost: 2 });
    }
  });
  it("keeps the Block cost read-only even when every displayed magnitude is two", () => {
    const original = cardById["shield-bash"]!;
    const bonus = getEditableCorruptionTargets(original).find((entry) => entry.field === "blockDamageBonus")!;
    const lowered = applyNumericCorruption(original, bonus, -1);
    const target = getEditableCorruptionTargets(lowered).find((entry) => entry.field === "blockDamageBonus")!;
    expect(lowered.descriptionLines[target.lineIndex]!.slice(target.matchIndex)).toBe("2 damage");
    const restored = applyNumericCorruption(lowered, target, 1);
    expect(restored.effects[0]).toMatchObject({ amount: 2, blockCost: 2, blockDamageBonus: 3 });
    expect(validateCardDescriptionParity(restored)).toEqual([]);
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
