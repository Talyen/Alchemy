// Shared shape for per-kind effect modules (schema + dispatch metadata).
import type { z } from "zod";
import type { BattleCardEffect } from "../types";
import type { EffectDispatchRoute } from "./dispatch-routes";

export type EffectKindDefinition<K extends BattleCardEffect["kind"] = BattleCardEffect["kind"]> = {
  kind: K;
  dispatchRoute: EffectDispatchRoute;
  /** Runtime-validated; use ZodTypeAny so optional fields align with exactOptionalPropertyTypes. */
  schema: z.ZodTypeAny;
};
