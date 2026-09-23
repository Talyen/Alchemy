import type { BattleCard, BattleCardEffect, DamageType } from "@/lib/game-data";
import type { CardEffectResolutionContext } from "./effect-handlers/handler-types";

type DamageEffect = Extract<BattleCardEffect, { kind: "damage" }>;

export type FollowUpHitRequest =
  | Readonly<{ source: "player-follow-up"; damageType: DamageType; amount: number }>
  | Readonly<{ source: "talent-fixed" | "talent-derived"; damageType: DamageType; amount: number }>;

export type CardHitRequest = Readonly<{
  source: "card-attack" | "archery-extra";
  card: BattleCard;
  effect: DamageEffect;
  /** Already scaled and mitigated. Extra hits copy this amount without recalculating it. */
  resolvedDamage: number;
  critical?: boolean;
  origin?: CardEffectResolutionContext["origin"];
  onDamageDealt?: ((amount: number) => void) | undefined;
}>;

export type HitRequest =
  | CardHitRequest
  | FollowUpHitRequest
  | Readonly<{ source: "reflected-holy"; blockLost: number }>
  | Readonly<{ source: "attack-purge" }>;
