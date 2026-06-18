// Shared shape for per-kind effect modules (schema + dispatch metadata).
import type { z } from "zod";
import type { BattleCardEffect } from "../types";

export type EffectKindDefinition<K extends BattleCardEffect["kind"] = BattleCardEffect["kind"]> = {
  kind: K;
  /** Runtime-validated; use ZodTypeAny so optional fields align with exactOptionalPropertyTypes. */
  schema: z.ZodTypeAny;
};
