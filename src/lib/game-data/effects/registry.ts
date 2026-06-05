// Maps each BattleCardEffect kind to its battle-engine dispatch route.
import type { BattleCardEffect } from "../types";
import { BATTLE_CARD_EFFECT_KINDS, type BattleCardEffectKind } from "./kinds";
import type { EffectDispatchRoute } from "./dispatch-routes";
import { ALL_EFFECT_REGISTRY_ENTRIES } from "./template-definitions";

const EFFECT_DISPATCH_ROUTE = Object.fromEntries(
  ALL_EFFECT_REGISTRY_ENTRIES.map((entry) => [entry.kind, entry.dispatchRoute]),
) as Record<BattleCardEffectKind, EffectDispatchRoute>;

export type { EffectDispatchRoute } from "./dispatch-routes";

export function getEffectDispatchRoute(kind: BattleCardEffect["kind"]): EffectDispatchRoute | undefined {
  return EFFECT_DISPATCH_ROUTE[kind as BattleCardEffectKind];
}

export const REGISTERED_EFFECT_KINDS: readonly BattleCardEffectKind[] = BATTLE_CARD_EFFECT_KINDS;
