import { capitalizeWord } from "@/lib/utils";
import { isPotionCard } from "./cards/card-pools";
import { formatCompanionTurnStartLine } from "./cards/companion-turn-description";
import { companionLibrary } from "./companions";
import type { BattleCard, BattleCardEffect, CompanionId } from "./types";

export interface CardDescriptionContext {
  flatPhysicalDamage?: number;
  companionDamage?: number;
  companionDamageBonus?: number;
  companionDamageBuff?: number;
  companionBondLevels?: Record<string, number>;
  potionPotency?: number;
}

function displayDamageType(type: string): string {
  return capitalizeWord(type);
}

function getPotionMultiplier(card: Pick<BattleCard, "id">, context: CardDescriptionContext): number {
  return isPotionCard(card) ? (context.potionPotency ?? 1) : 1;
}

function adjustedAmount(amount: number, multiplier: number): number {
  return Math.round(amount * multiplier);
}

function adjustedDamageAmount(
  effect: Extract<BattleCard["effects"][number], { kind: "damage" }>,
  context: CardDescriptionContext,
  potionMultiplier: number,
): number {
  const physicalBonus = effect.damageType === "physical" ? (context.flatPhysicalDamage ?? 0) : 0;
  return adjustedAmount(effect.amount, potionMultiplier) + physicalBonus;
}

function getSummonedCompanionId(card: Pick<BattleCard, "effects">): CompanionId | null {
  const effect = card.effects.find(
    (e): e is { kind: "summon-companion"; companionId: CompanionId } => e.kind === "summon-companion",
  );
  return effect?.companionId ?? null;
}

const COMPANION_TURN_LINE_REGEX =
  /^(?:Deals \d+|Restores \d+|Cleanses \d+|Steals \d+|Gains? \d+ Block each turn|Draws \d+)/;

function isCompanionTurnLine(line: string): boolean {
  return COMPANION_TURN_LINE_REGEX.test(line);
}

function getCompanionLine(card: Pick<BattleCard, "effects">, context: CardDescriptionContext): string | null {
  const companionId = getSummonedCompanionId(card);
  if (!companionId) return null;
  const companion = companionLibrary[companionId];
  const turnEffect = companion.turnStartEffects[0];
  if (!turnEffect) return null;

  return formatCompanionTurnStartLine(turnEffect, {
    bondLevel: context.companionBondLevels?.[companionId] ?? 0,
    damageBonus:
      (context.companionDamage ?? 0) + (context.companionDamageBonus ?? 0) + (context.companionDamageBuff ?? 0),
  });
}

function formatEffectiveLine(
  line: string,
  getNextEffect: <T extends BattleCardEffect["kind"]>(kind: T) => Extract<BattleCardEffect, { kind: T }> | undefined,
  context: CardDescriptionContext,
  potionMultiplier: number,
): string {
  if (line.startsWith("Deal ")) {
    const effect = getNextEffect("damage");
    if (!effect || effect.equalToBlock || effect.equalToArmor || effect.equalToGoldPercent) return line;
    return `Deal ${adjustedDamageAmount(effect, context, potionMultiplier)} ${displayDamageType(effect.damageType)} damage`;
  }

  if (line.startsWith("Gain ")) {
    if (line.includes(" Gold")) {
      const effect = getNextEffect("gain-gold");
      return effect ? `Gain ${adjustedAmount(effect.amount, potionMultiplier)} Gold` : line;
    }
    const effect = getNextEffect("player-status");
    if (!effect || effect.perManaCrystal) return line;
    return `Gain ${adjustedAmount(effect.amount, potionMultiplier)} ${displayDamageType(effect.status)}`;
  }

  if (line.startsWith("Heal ")) {
    const effect = getNextEffect("heal");
    return effect ? `Heal ${adjustedAmount(effect.amount, potionMultiplier)}` : line;
  }

  if (line.startsWith("Restore ")) {
    const effect = getNextEffect("restore-mana");
    return effect ? `Restore ${adjustedAmount(effect.amount, potionMultiplier)} Mana` : line;
  }

  if (line.startsWith("Wish ")) {
    const effect = getNextEffect("wish");
    return effect ? `Wish ${adjustedAmount(effect.amount, potionMultiplier)}` : line;
  }

  if (line.startsWith("Remove ")) {
    const effect = getNextEffect("remove-harmful-status");
    // Full cleanses keep their authored wording — the amount is a handler cap, not a display number.
    if (!effect || effect.removeAll) return line;
    const amount = adjustedAmount(effect.amount, potionMultiplier);
    return `Remove ${amount} harmful Status${amount === 1 ? "" : "es"}`;
  }

  return line;
}

function createEffectCursor(effects: readonly BattleCardEffect[]) {
  const cursors = new Map<string, number>();
  return function getNextEffect<T extends BattleCardEffect["kind"]>(
    kind: T,
  ): Extract<BattleCardEffect, { kind: T }> | undefined {
    const startIndex = cursors.get(kind) ?? 0;
    for (let i = startIndex; i < effects.length; i++) {
      const effect = effects[i];
      if (effect?.kind === kind) {
        cursors.set(kind, i + 1);
        return effect as Extract<BattleCardEffect, { kind: T }>;
      }
    }
    cursors.set(kind, effects.length);
    return undefined;
  };
}

/** Returns description lines whose numbers match known mechanical bonuses. */
export function getEffectiveCardDescriptionLines(
  card: Pick<BattleCard, "id" | "effects" | "descriptionLines">,
  context: CardDescriptionContext = {},
): string[] {
  const potionMultiplier = getPotionMultiplier(card, context);
  const companionLine = getCompanionLine(card, context);
  const getNextEffect = createEffectCursor(card.effects);

  return card.descriptionLines.map((line) => {
    if (companionLine && isCompanionTurnLine(line)) return companionLine;
    return formatEffectiveLine(line, getNextEffect, context, potionMultiplier);
  });
}
