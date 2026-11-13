import { describe, expect, it, vi } from "vitest";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { resolveEnemyAttackHit } from "@/lib/battle/enemy-attack-hit";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { tickPlayerStatuses } from "@/lib/battle/status-ticks";
import { getTransmutationVariants } from "@/lib/alchemist/transmutation";
import { cardById, withCardDescription, createEffectDescription, type BattleCard } from "@/lib/game-data";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { normalizeSavedCardDefinition } from "@/lib/game-data/cards/normalize-saved-definition";
import { hydrateAlchemyVisit } from "@/lib/active-run-session/alchemy-visits";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { createSeededRng } from "@/lib/rng";
import { getPlayerStatusChips } from "@/features/alchemy/shared/utils/battle";
import { patchBattleState } from "../../fixtures/battle";

const elusive = getTransmutationVariants(cardById.heal!, "dodge", [cardById.heal!])[0]!.result;
const hit = { kind: "damage" as const, damageType: "physical" as const, amount: 4 };
const attack = (state: ReturnType<typeof patchBattleState>, canDodge = true) =>
  resolveEnemyAttackHit(state, hit, [], { canDodge });

function legacyElusive(source = cardById.slash!): BattleCard {
  const effects = [...source.effects, { kind: "dodge-next-attack" as const }];
  return withCardDescription({ ...source, effects, transmuted: "dodge" }, createEffectDescription(effects));
}

describe("Elusive's next attack chance", () => {
  it("previews the exact chance and pays the original cost without rolling on play", () => {
    const rng = vi.fn(() => 0.99);
    const state = patchBattleState({ hand: [elusive], mana: 3, rng });
    const played = playBattleCardResolved(state, elusive.id, 0).state;
    expect(elusive.descriptionLines).toContain("50% chance to Dodge the next attack.");
    expect(played.mana).toBe(2);
    expect(played.flags.dodgeNextAttack).toBe(false);
    expect(played.flags.dodgeNextAttackChance).toBe(50);
    expect(getPlayerStatusChips(played)).toContainEqual(expect.objectContaining({ id: "dodgeNextAttackChance" }));
    expect(rng).not.toHaveBeenCalled();
    expect(cardById.feint!.descriptionLines).toContain("Dodge the next attack");
  });

  it.each([
    { seed: 7, dodged: true },
    { seed: 1, dodged: false },
  ])("consumes the preparation on seeded success or failure ($seed)", ({ seed, dodged }) => {
    const rng = vi.fn(createSeededRng(seed));
    const state = applyCardEffects(patchBattleState({ rng }), elusive, []);
    const result = attack(state);
    expect(result.dodged).toBe(dodged);
    expect(result.state.playerHealth).toBe(state.playerHealth - (dodged ? 0 : 4));
    expect(result.state.flags.dodgeNextAttackChance).toBe(0);
    expect(rng).toHaveBeenCalledTimes(1);
  });

  it("reapplication adds neither probability nor attempts across successive packets", () => {
    const rng = vi.fn(() => 0.49);
    const prepared = applyCardEffects(patchBattleState({ rng }), elusive, []);
    const repeated = applyCardEffects(prepared, elusive, []);
    expect(repeated.flags.dodgeNextAttackChance).toBe(50);
    expect(rng).not.toHaveBeenCalled();
    const first = attack(repeated);
    const second = attack(first.state);
    expect(first.dodged).toBe(true);
    expect(second.dodged).toBe(false);
    expect(second.state.playerHealth).toBe(repeated.playerHealth - 4);
    expect(rng).toHaveBeenCalledTimes(2);
  });

  it("uses one roll at the better existing Dodge chance", () => {
    const rng = vi.fn(() => 0.7);
    const state = applyCardEffects(patchBattleState({ rng, gearEffects: { dodgeChance: 70 } }), elusive, []);
    expect(attack(state).dodged).toBe(true);
    expect(rng).toHaveBeenCalledTimes(1);
  });

  it.each(["stunSkipTurns", "freezeSkipTurns"] as const)("retains preparation during %s", (control) => {
    const rng = vi.fn(() => 0);
    const state = applyCardEffects(patchBattleState({ rng, playerCC: { [control]: 1 } }), elusive, []);
    const result = attack(state);
    expect(result.dodged).toBe(false);
    expect(result.state.flags.dodgeNextAttackChance).toBe(50);
    expect(rng).not.toHaveBeenCalled();
  });

  it("retains preparation through utility turns, zero-power hits, DoTs and undodgeable damage", () => {
    const rng = vi.fn(() => 0);
    const state = applyCardEffects(patchBattleState({ rng, playerStatuses: { burn: 2 } }), elusive, []);
    const utility = applyCardEffects(state, cardById["plate-mail"]!, []);
    const zero = resolveEnemyAttackHit(utility, { ...hit, amount: 0 }, [], { canDodge: true }).state;
    const pulse = attack(zero, false).state;
    const ticked = tickPlayerStatuses(pulse, []);
    expect(ticked.flags.dodgeNextAttackChance).toBe(50);
    expect(rng).not.toHaveBeenCalled();
  });

  it("native guaranteed Dodge wins without RNG and consumes both preparations", () => {
    const rng = vi.fn(() => 0.99);
    const state = applyCardEffects(patchBattleState({ rng }), elusive, []);
    const guaranteed = applyCardEffects(state, { ...cardById.feint!, effects: [{ kind: "dodge-next-attack" }] }, []);
    const reapplied = applyCardEffects(guaranteed, elusive, []);
    expect(getPlayerStatusChips(reapplied).filter((chip) => chip.id.startsWith("dodgeNextAttack"))).toEqual([
      expect.objectContaining({ id: "dodgeNextAttack" }),
    ]);
    const first = attack(reapplied);
    expect(first.dodged).toBe(true);
    expect(first.state.flags).toMatchObject({ dodgeNextAttack: false, dodgeNextAttackChance: 0 });
    expect(rng).not.toHaveBeenCalled();
    expect(attack(first.state).dodged).toBe(false);
  });

  it("keeps a fresh preparation earned by Dance of Blades after consuming old preparations", () => {
    const state = patchBattleState({
      rng: () => 0,
      flags: { dodgeNextAttack: true, dodgeNextAttackChance: 50 },
      gearEffects: { dodgeDrawAndPlay: 1 },
      deck: [elusive],
    });
    expect(attack(state).state.flags).toMatchObject({ dodgeNextAttack: false, dodgeNextAttackChance: 50 });
  });

  it("round-trips the pending percentage and consumes a failed attempt after reload", () => {
    const state = applyCardEffects(patchBattleState({ hand: [elusive] }), elusive, []);
    const restored = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(state)));
    expect(restored.flags.dodgeNextAttackChance).toBe(50);
    expect(attack({ ...restored, rng: () => 0.99 }).state.flags.dodgeNextAttackChance).toBe(0);
  });
});

describe("saved Elusive definitions", () => {
  it.each([true, false])("normalizes only the appended Dodge and its prose (structured=%s)", (structured) => {
    const card = legacyElusive({ ...cardById.slash!, cost: 3 });
    const magnitude = card.description!.flatMap((line) => line.parts).find((part) => typeof part !== "string");
    if (!magnitude) throw new Error("Expected an editable damage magnitude");
    magnitude.distilled = true;
    if (!structured) delete card.description;
    const before = structuredClone(card);
    const restored = hydrateCard(JSON.parse(JSON.stringify(card)));
    expect(restored.effects).toEqual([...card.effects.slice(0, -1), { kind: "dodge-next-attack", probability: 0.5 }]);
    expect(restored.cost).toBe(3);
    expect(restored.descriptionLines).toContain("50% chance to Dodge the next attack.");
    if (structured)
      expect(restored.description![0]!.parts).toContainEqual(expect.objectContaining({ distilled: true }));
    expect(card).toEqual(before);
    expect(hydrateCard(restored)).toEqual(restored);
    const visit = hydrateAlchemyVisit({ offers: [card], result: card, original: card, completed: true });
    expect(visit!.offers[0]!.effects).toEqual(restored.effects);
    expect(visit!.result!.effects).toEqual(restored.effects);
    const pending = hydrateAlchemyVisit({
      offers: [],
      original: null,
      result: null,
      completed: false,
      transmutation: {
        choices: [
          {
            keyword: "dodge",
            alterations: [{ sourceIndex: 0, source: cardById.slash!, sourceKeyword: null, result: card }],
          },
        ],
        sourceIndex: 0,
        source: cardById.slash!,
        keyword: "dodge",
        offerIndex: 0,
      },
    });
    expect(pending!.transmutation!.choices[0]!.alterations[0]!.result.effects).toEqual(restored.effects);
  });

  it("composes with Shield Bash normalization and leaves damage-only echoes untouched", () => {
    const source = { ...cardById["shield-bash"]!, definitionVersion: 0 };
    const effects = source.effects.map((effect) =>
      effect.kind === "damage" ? { ...effect, spendBlock: false } : effect,
    );
    const card = legacyElusive(withCardDescription({ ...source, effects }, createEffectDescription(effects)));
    const restored = normalizeSavedCardDefinition(card).card;
    expect(restored.effects).toContainEqual(expect.objectContaining({ kind: "damage", spendBlock: true }));
    expect(restored.effects.at(-1)).toEqual({ kind: "dodge-next-attack", probability: 0.5 });
    const echo = { ...legacyElusive(), effects: [...cardById.slash!.effects] };
    expect(normalizeSavedCardDefinition(echo).card.effects).toEqual(echo.effects);
    expect(normalizeSavedCardDefinition(cardById.feint!).card).toBe(cardById.feint);
  });
});
