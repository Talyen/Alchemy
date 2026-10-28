import { CAMPFIRE_HEAL_FRACTION } from "@/lib/game-constants";
import { capitalizeWord } from "@/lib/utils";
import { areBattleCardEffectsEqual } from "./effect-tree";
import { companionLibrary } from "./companions";
import { getCompanionDescriptionLines } from "./cards/companion-turn-description";
import {
  cardMagnitude,
  type CardDescriptionPart,
  type CardEffectAddress,
  type CardMagnitude,
  type CardMagnitudeReference,
} from "./card-description-model";
import type { BattleCardEffect } from "./types";

type EffectDescription = CardDescriptionPart[][];

function joinOptions(items: readonly string[], alwaysComma = false): string {
  const rest = [...items];
  const last = rest.pop() ?? "";
  if (rest.length === 0) return last;
  return `${rest.join(", ")}${rest.length > 1 || alwaysComma ? "," : ""} or ${last}`;
}

function value(
  effect: BattleCardEffect,
  address: CardEffectAddress,
  field: CardMagnitudeReference["field"],
  options?: Omit<CardMagnitude, "kind" | "id" | "references">,
): CardMagnitude {
  // The renderer selects fields under the effect-kind switch. Public authoring
  // uses cardMagnitude's discriminated reference rather than this dynamic seam.
  return cardMagnitude({ ...address, kind: effect.kind, field } as CardMagnitudeReference, options);
}

function childAddress(address: CardEffectAddress, child: number): CardEffectAddress {
  return { effectIndex: address.effectIndex, effectPath: [...(address.effectPath ?? []), child] };
}

function createConditionalDamageLine(
  effect: BattleCardEffect,
  address: CardEffectAddress,
): CardDescriptionPart[] | undefined {
  if (effect.kind !== "damage") return undefined;
  const base: CardDescriptionPart[] = [
    "Deal ",
    value(effect, address, "amount"),
    ` ${capitalizeWord(effect.damageType)} damage`,
  ];
  if (effect.damageTypeIfTargetFrozen)
    return [
      ...base,
      "; Against Frozen enemies, deal ",
      value(effect, address, "amountIfTargetFrozen"),
      ` ${capitalizeWord(effect.damageTypeIfTargetFrozen)} instead`,
    ];
  return undefined;
}

function createEffectLine(effect: BattleCardEffect, address: CardEffectAddress): CardDescriptionPart[] {
  const amount = (format?: CardMagnitude["format"]) =>
    value(effect, address, "amount", format ? { format } : undefined);
  switch (effect.kind) {
    case "damage": {
      const type = capitalizeWord(effect.damageType);
      if (effect.equalToBlock) {
        const percent = effect.equalToBlockPercent ?? 100;
        if (effect.spendBlock)
          return [
            `Spend ${percent === 100 ? "all " : percent === 50 ? "half " : `${percent}% of `}your Block to deal ${type} damage`,
          ];
        return [
          `Deal ${type} damage equal to ${percent === 100 ? "" : percent === 50 ? "half " : `${percent}% of `}your Block`,
        ];
      }
      if (effect.equalToArmor) return [`Deal ${type} damage equal to your Armor`];
      if (effect.forgeBonusPercent !== undefined)
        return [
          "Deal ",
          amount(),
          ` ${type} damage, increased by ${effect.forgeBonusPercent === 50 ? "half" : `${effect.forgeBonusPercent}% of`} your Forge`,
        ];
      const conditional = createConditionalDamageLine(effect, address);
      if (conditional) return conditional;
      return [
        "Deal ",
        amount(),
        ` ${effect.damageTypePool?.length ? joinOptions(effect.damageTypePool.map(capitalizeWord)) : type} damage`,
      ];
    }
    case "random-damage":
      return [
        "Deal ",
        value(effect, address, "minAmount"),
        "–",
        value(effect, address, "maxAmount"),
        ` ${effect.damageTypePool?.length ? joinOptions(effect.damageTypePool.map(capitalizeWord), true) : "Random"} damage`,
      ];
    case "player-status": {
      const status = capitalizeWord(effect.status);
      if (effect.perManaCrystal !== undefined)
        return ["Gain ", value(effect, address, "perManaCrystal"), ` ${status} per Mana Crystal`];
      if (effect.convertCurrentMana !== undefined)
        return ["Convert each of your Mana into ", value(effect, address, "convertCurrentMana"), ` ${status}`];
      if (effect.status === "haste") return ["Take ", amount("turns"), " after this one"];
      if (effect.status === "phoenixFeather")
        return [`Upon death, revive with ${Math.round(CAMPFIRE_HEAL_FRACTION * 100)}% Health`];
      if (effect.statusPool && effect.forgeAmount !== undefined)
        return [
          "Gain ",
          amount(),
          " Block, ",
          value(effect, address, "forgeAmount"),
          " Forge, or ",
          amount(),
          " Armor",
        ];
      if (effect.statusPool) return ["Gain ", amount(), ` ${joinOptions(effect.statusPool.map(capitalizeWord), true)}`];
      if (["block", "armor", "thorns", "forge"].includes(effect.status)) return ["Gain ", amount(), ` ${status}`];
      throw new Error(`effectDescriptionLine: unsupported player-status ${effect.status}`);
    }
    case "heal":
      return ["Restore ", amount(), " Health"];
    case "restore-mana":
      return ["Gain ", amount(), ` Mana${effect.allowOverflow ? ", allowing overflow" : ""}`];
    case "lose-mana":
      return ["Lose ", amount(), " Mana"];
    case "lose-max-mana":
      return ["Lose ", amount("crystals")];
    case "gain-max-mana":
      return ["Gain ", amount("crystals")];
    case "gain-gold":
      return ["Gain ", amount(), ` Gold${effect.ifEnemyStunned ? " if the enemy is Stunned" : ""}`];
    case "wish":
      return effect.companionIfAbsent ? ["If you don't have a Companion, Wish for one"] : ["Wish ", amount()];
    case "companion-action":
      return ["Your Companion acts ", amount("companion")];
    case "random-draw":
      return [`Draw ${effect.minAmount}–${effect.maxAmount} cards`];
    case "remove-harmful-status": {
      if (effect.removeAll) return ["Cleanse all harmful status effects"];
      if (effect.amount === undefined)
        throw new Error("effectDescriptionLine: remove-harmful-status needs amount without removeAll");
      return ["Cleanse ", amount("cleanse")];
    }
    case "lose-health":
      return ["Lose ", amount(), " Health"];
    case "draw-cards":
      return ["Draw ", amount("draw")];
    case "remove-enemy-armor": {
      if (effect.halve) return ["Halve enemy Armor"];
      if (effect.removeAll) return ["Remove all enemy Armor"];
      if (effect.amount === undefined)
        throw new Error("effectDescriptionLine: remove-enemy-armor needs amount without removeAll");
      return ["Remove ", amount(), " enemy Armor"];
    }
    case "multiply-enemy-status":
      return [
        `${effect.factor === 2 ? "Double" : `Multiply by ${effect.factor}`} the enemy's ${capitalizeWord(effect.status)}${effect.status === "stun" || effect.status === "freeze" ? " build-up" : ""}`,
      ];
    case "remove-player-status":
      return [
        `Cleanse ${capitalizeWord(effect.status)}${effect.status === "stun" || effect.status === "freeze" ? " build-up" : ""}`,
      ];
    case "self-damage":
      return ["Take ", amount(), ` ${capitalizeWord(effect.damageType)} damage`];
    case "next-hit-crit":
      return ["Your next card hit is a critical strike"];
    case "next-hit-leech":
      return ["Your next card hit has Leech"];
    case "play-next-card-twice":
      return ["Your next card is played twice"];
    case "next-hit-poison":
      return ["Your next attack deals Poison"];
    case "next-archery-free":
      return ["Your next Archery card is free"];
    case "dodge-next-attack":
      return ["Dodge the next attack"];
    case "summon-companion":
    case "chance":
    case "repeat-over-turns":
    case "cleanse-player-status-to-damage":
      throw new Error(`effectDescriptionLine: unsupported effect kind ${effect.kind}`);
  }
}

function damageLines(
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  address: CardEffectAddress,
): EffectDescription {
  const lines: EffectDescription = [];
  if (effect.damageTypeIfTargetFrozen === effect.damageType && effect.amountIfTargetFrozen === effect.amount * 2) {
    lines.push(
      [
        "Deal ",
        cardMagnitude(
          { ...address, kind: "damage", field: "amount" },
          { shared: [{ ...address, kind: "damage", field: "amountIfTargetFrozen", multiplier: 2 }] },
        ),
        ` ${capitalizeWord(effect.damageType)} damage`,
      ],
      ["Doubled against Frozen enemies"],
    );
  } else lines.push(createEffectLine(effect, address));
  if (effect.ignoreArmor || effect.ignoreBlock)
    lines.push([`Ignores ${effect.ignoreArmor ? (effect.ignoreBlock ? "Armor and Block" : "Armor") : "Block"}`]);
  if (effect.doubleIfEnemyBleeding) lines.push(["Doubled if the enemy was already Bleeding"]);
  if (effect.tripleIfEnemyNotBurning) lines.push(["Tripled if enemy was not Burning"]);
  if (effect.detonateAllBurn) lines.push(["Detonate all Burn"]);
  if (effect.detonateAllBleed) lines.push(["Detonate all Bleed"]);
  return lines;
}

function resourceChoice(
  effect: BattleCardEffect,
  address: CardEffectAddress,
): { label: string; amount: number; reference: CardMagnitudeReference } | null {
  if (effect.kind === "restore-mana" && !effect.allowOverflow)
    return { label: "Mana", amount: effect.amount, reference: { ...address, kind: effect.kind, field: "amount" } };
  if (effect.kind === "gain-gold" && !effect.ifEnemyStunned)
    return { label: "Gold", amount: effect.amount, reference: { ...address, kind: effect.kind, field: "amount" } };
  if (
    effect.kind === "player-status" &&
    effect.status === "block" &&
    !effect.statusPool &&
    effect.perManaCrystal === undefined &&
    effect.convertCurrentMana === undefined
  )
    return { label: "Block", amount: effect.amount, reference: { ...address, kind: effect.kind, field: "amount" } };
  return null;
}

function joinLines(lines: EffectDescription): CardDescriptionPart[] {
  const parts: CardDescriptionPart[] = [];
  for (const [index, line] of lines.entries()) {
    if (index) parts.push("; ");
    parts.push(...line);
  }
  return parts;
}

function chanceLines(
  effect: Extract<BattleCardEffect, { kind: "chance" }>,
  address: CardEffectAddress,
): EffectDescription {
  const success = effect.successEffects[0];
  const failure = effect.failureEffects[0];
  if (
    effect.probability === 0.5 &&
    effect.successEffects.length === 1 &&
    effect.failureEffects.length === 1 &&
    success?.kind === "wish" &&
    success.amount === 1 &&
    failure?.kind === "gain-gold" &&
    !failure.ifEnemyStunned
  )
    return [["Gain ", value(failure, childAddress(address, 1), "amount"), " Gold or Wish"]];
  // A flat "Gain X A, B, or C" line reads as one shared draw, so it must only
  // collapse a single even chance. Nested trees carry per-level odds (Luck
  // Potion is 50% Mana, then 50% Gold within the remainder); collapsing them
  // would advertise three equal outcomes for a 50/25/25 split.
  if (
    effect.probability === 0.5 &&
    effect.successEffects.length === 1 &&
    effect.failureEffects.length === 1 &&
    success &&
    failure
  ) {
    const first = resourceChoice(success, childAddress(address, 0));
    const second = resourceChoice(failure, childAddress(address, 1));
    if (first && second && first.amount === second.amount)
      return [
        [
          "Gain ",
          cardMagnitude(first.reference, { shared: [second.reference] }),
          ` ${joinOptions([first.label, second.label])}`,
        ],
      ];
  }
  if (!effect.successEffects.length) throw new Error("Chance effect needs a success outcome");
  const lines: EffectDescription = [
    [
      `${Math.round(effect.probability * 100)}% chance: `,
      ...joinLines(describeEffects(effect.successEffects, (index) => childAddress(address, index))),
    ],
  ];
  if (effect.failureEffects.length)
    lines.push([
      "Otherwise: ",
      ...joinLines(
        describeEffects(effect.failureEffects, (index) => childAddress(address, effect.successEffects.length + index)),
      ),
    ]);
  return lines;
}

function shareLine(line: CardDescriptionPart[], address: CardEffectAddress): CardDescriptionPart[] {
  return line.map((part) =>
    typeof part === "string"
      ? part
      : {
          ...part,
          references: [...part.references, ...part.references.map((reference) => ({ ...reference, ...address }))],
        },
  );
}

function describeEffects(
  effects: readonly BattleCardEffect[],
  addressFor: (index: number) => CardEffectAddress,
  keywordCount?: { value: number },
): EffectDescription {
  const lines: EffectDescription = [];
  for (let index = 0; index < effects.length; index++) {
    const effect = effects[index];
    if (!effect) continue;
    const next = effects[index + 1];
    const address = addressFor(index);
    if (effect.kind === "summon-companion") {
      lines.push(...getCompanionDescriptionLines(companionLibrary[effect.companionId]).map((line) => [line]));
      continue;
    }
    if (
      effect.kind === "remove-player-status" &&
      next?.kind === "remove-player-status" &&
      effect.status === "stun" &&
      next.status === "freeze"
    ) {
      lines.push(["Cleanse Stun and Freeze build-up"]);
      index++;
      continue;
    }
    if (next && effect.kind === "damage" && !effect.lifesteal) {
      if (
        next.kind === "self-damage" &&
        next.amount === effect.amount &&
        next.damageType === effect.damageType &&
        Object.keys(effect).length === 3
      ) {
        lines.push([
          "Deal and Receive ",
          cardMagnitude(
            { ...address, kind: "damage", field: "amount" },
            { shared: [{ ...addressFor(index + 1), kind: "self-damage", field: "amount" }] },
          ),
          ` ${capitalizeWord(effect.damageType)} damage`,
        ]);
        index++;
        continue;
      }
      const description = damageLines(effect, address);
      const repeated = description.length === 1 ? description[0] : undefined;
      if (repeated && areBattleCardEffectsEqual(effect, next)) {
        lines.push([...shareLine(repeated, addressFor(index + 1)), " twice"]);
        index++;
        continue;
      }
      const nextFirst = next.kind === "repeat-over-turns" ? next.effects[0] : undefined;
      if (
        repeated &&
        next.kind === "repeat-over-turns" &&
        next.remainingTurns === 1 &&
        next.effects.length === 1 &&
        nextFirst &&
        areBattleCardEffectsEqual(effect, nextFirst)
      ) {
        lines.push([...shareLine(repeated, childAddress(addressFor(index + 1), 0)), " this turn and next"]);
        index++;
        continue;
      }
    }
    if (effect.kind === "chance") {
      lines.push(...chanceLines(effect, address));
      continue;
    }
    if (effect.kind === "repeat-over-turns") {
      lines.push(
        ...describeEffects(effect.effects, (child) => childAddress(address, child)).map((line) => [
          ...line,
          ` ${effect.remainingTurns === 1 ? "next turn" : `for the next ${effect.remainingTurns} turns`}`,
        ]),
      );
      continue;
    }
    if (effect.kind === "random-draw" && effect.minAmount === 1 && effect.maxAmount === 6) {
      lines.push(["Roll a six-sided die"], ["Draw that many cards"]);
      continue;
    }
    if (
      effect.kind === "self-damage" &&
      next?.kind === "cleanse-player-status-to-damage" &&
      effect.damageType === next.status
    ) {
      lines.push(["Receive ", value(effect, address, "amount"), ` ${capitalizeWord(effect.damageType)} damage`]);
      continue;
    }
    if (effect.kind === "cleanse-player-status-to-damage") {
      lines.push(
        [`Cleanse all ${capitalizeWord(effect.status)} on yourself`],
        [`Deal ${capitalizeWord(effect.damageType)} damage equal to ${capitalizeWord(effect.status)} removed`],
      );
      continue;
    }
    lines.push(...(effect.kind === "damage" ? damageLines(effect, address) : [createEffectLine(effect, address)]));
  }
  let leech = false;
  let companion = false;
  for (const effect of effects) {
    if ("lifesteal" in effect && effect.lifesteal) leech = true;
    companion ||= effect.kind === "summon-companion";
    if (leech && companion) break;
  }
  if (leech) lines.push(["Leech"]);
  if (companion) lines.push(["Companion"]);
  if (keywordCount) keywordCount.value = Number(leech) + Number(companion);
  return lines;
}

/** Text and mutation bindings are built together; prose is never parsed for rules. */
export function createEffectDescription(
  effects: readonly BattleCardEffect[],
): import("./card-description-model").CardDescription {
  const keywordCount = { value: 0 };
  const lines = describeEffects(effects, (effectIndex) => ({ effectIndex }), keywordCount);
  return lines.map((parts, index) => ({
    parts,
    role: index >= lines.length - keywordCount.value ? "keyword" : "effect",
  }));
}
