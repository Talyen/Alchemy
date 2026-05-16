// Computes player-facing card text after persistent and battle bonuses are applied.
// Depends on card effects and manifests; rendering components stay presentation-only.
import { POTION_CARD_ID_FRAGMENT } from "@/lib/game-constants";
import { companionLibrary, type BattleCard, type CompanionId } from "@/lib/game-data";

export type CardDescriptionContext = {
  flatPhysicalDamage?: number;
  companionDamage?: number;
  companionDamageBonus?: number;
  companionDamageBuff?: number;
  companionBondLevels?: Record<string, number>;
  potionPotency?: number;
};

function displayDamageType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getPotionMultiplier(card: Pick<BattleCard, "id">, context: CardDescriptionContext): number {
  return card.id.includes(POTION_CARD_ID_FRAGMENT) ? (context.potionPotency ?? 1) : 1;
}

function adjustedAmount(amount: number, multiplier: number): number {
  return Math.round(amount * multiplier);
}

function adjustedDamageAmount(effect: Extract<BattleCard["effects"][number], { kind: "damage" }>, context: CardDescriptionContext, potionMultiplier: number): number {
  const physicalBonus = effect.damageType === "physical" ? (context.flatPhysicalDamage ?? 0) : 0;
  return adjustedAmount(effect.amount, potionMultiplier) + physicalBonus;
}

function getSummonedCompanionId(card: Pick<BattleCard, "effects">): CompanionId | null {
  const effect = card.effects.find((e): e is { kind: "summon-companion"; companionId: CompanionId } => e.kind === "summon-companion");
  return effect?.companionId ?? null;
}

function getCompanionLine(card: Pick<BattleCard, "effects">, context: CardDescriptionContext): string | null {
  const companionId = getSummonedCompanionId(card);
  if (!companionId) return null;
  const companion = companionLibrary[companionId];
  const attack = companion?.turnStartEffects.find((effect) => effect.kind === "damage");
  if (!attack) return null;

  const bondLevel = context.companionBondLevels?.[companionId] ?? 0;
  const globalBonus = (context.companionDamage ?? 0) + (context.companionDamageBonus ?? 0) + (context.companionDamageBuff ?? 0);
  return `Deals ${attack.amount + bondLevel + globalBonus} ${displayDamageType(attack.damageType)} damage each turn`;
}

// Returns description lines whose numbers match known mechanical bonuses.
export function getEffectiveCardDescriptionLines(
  card: Pick<BattleCard, "id" | "effects" | "descriptionLines">,
  context: CardDescriptionContext = {},
): string[] {
  const potionMultiplier = getPotionMultiplier(card, context);
  const companionLine = getCompanionLine(card, context);
  let damageIndex = 0;
  let playerStatusIndex = 0;
  let healIndex = 0;
  let manaIndex = 0;
  let goldIndex = 0;
  let wishIndex = 0;
  let cleanseIndex = 0;
  const damageEffects = card.effects.filter((effect): effect is Extract<BattleCard["effects"][number], { kind: "damage" }> => effect.kind === "damage");
  const playerStatusEffects = card.effects.filter((effect): effect is Extract<BattleCard["effects"][number], { kind: "player-status" }> => effect.kind === "player-status");
  const healEffects = card.effects.filter((effect): effect is Extract<BattleCard["effects"][number], { kind: "heal" }> => effect.kind === "heal");
  const manaEffects = card.effects.filter((effect): effect is Extract<BattleCard["effects"][number], { kind: "restore-mana" }> => effect.kind === "restore-mana");
  const goldEffects = card.effects.filter((effect): effect is Extract<BattleCard["effects"][number], { kind: "gain-gold" }> => effect.kind === "gain-gold");
  const wishEffects = card.effects.filter((effect): effect is Extract<BattleCard["effects"][number], { kind: "wish" }> => effect.kind === "wish");
  const cleanseEffects = card.effects.filter((effect): effect is Extract<BattleCard["effects"][number], { kind: "remove-harmful-status" }> => effect.kind === "remove-harmful-status");

  return card.descriptionLines.map((line) => {
    if (companionLine && line.startsWith("Deals ")) return companionLine;
    if (line.startsWith("Deal ")) {
      const effect = damageEffects[damageIndex++];
      if (effect?.equalToBlock || effect?.equalToArmor) return line;
      return effect ? `Deal ${adjustedDamageAmount(effect, context, potionMultiplier)} ${displayDamageType(effect.damageType)} damage` : line;
    }
    if (line.startsWith("Gain ") && line.includes(" Gold")) {
      const effect = goldEffects[goldIndex++];
      return effect ? `Gain ${adjustedAmount(effect.amount, potionMultiplier)} Gold` : line;
    }
    if (line.startsWith("Gain ")) {
      const effect = playerStatusEffects[playerStatusIndex++];
      return effect ? `Gain ${adjustedAmount(effect.amount, potionMultiplier)} ${displayDamageType(effect.status)}` : line;
    }
    if (line.startsWith("Heal ")) {
      const effect = healEffects[healIndex++];
      return effect ? `Heal ${adjustedAmount(effect.amount, potionMultiplier)}` : line;
    }
    if (line.startsWith("Restore ")) {
      const effect = manaEffects[manaIndex++];
      return effect ? `Restore ${adjustedAmount(effect.amount, potionMultiplier)} Mana` : line;
    }
    if (line.startsWith("Wish ")) {
      const effect = wishEffects[wishIndex++];
      return effect ? `Wish ${adjustedAmount(effect.amount, potionMultiplier)}` : line;
    }
    if (line.startsWith("Remove ")) {
      const effect = cleanseEffects[cleanseIndex++];
      return effect ? `Remove ${adjustedAmount(effect.amount, potionMultiplier)} harmful Status${adjustedAmount(effect.amount, potionMultiplier) === 1 ? "" : "es"}` : line;
    }
    return line;
  });
}
