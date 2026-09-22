import type { BattleCard, BattleCardEffect, DamageType } from "@/lib/game-data";
import type { CardEffectResolutionContext } from "./effect-handlers/handler-types";

type DamageEffect = Extract<BattleCardEffect, { kind: "damage" }>;

export type FollowUpHitRequest =
  | Readonly<{ source: "player-follow-up"; damageType: DamageType; amount: number }>
  | Readonly<{ source: "talent-fixed" | "talent-derived"; damageType: DamageType; amount: number }>;

type CardHitRequest = Readonly<{
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
  | Readonly<{ source: "blocked-attack"; amount: number }>
  | Readonly<{ source: "attack-purge" }>;

/** Internal prepared form for the legacy recipe; ordinary requests always carry a real card. */
export type CardRecipeRequest =
  | CardHitRequest
  | Readonly<{
      source: "blocked-attack";
      card?: undefined;
      effect: DamageEffect;
      resolvedDamage: number;
      critical?: boolean;
      origin?: undefined;
      onDamageDealt?: undefined;
    }>;
