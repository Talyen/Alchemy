// Battle card effect kinds, Zod schemas, and dispatch registry — single entry for effect contracts.
export { BATTLE_CARD_EFFECT_KINDS, type BattleCardEffectKind } from "./kinds";
export { BattleCardEffectSchema } from "./schemas";
export { REGISTERED_EFFECT_KINDS, getEffectDispatchRoute, type EffectDispatchRoute } from "./registry";
export { ALL_EFFECT_REGISTRY_ENTRIES, TEMPLATE_EFFECT_DEFINITIONS } from "./template-definitions";
