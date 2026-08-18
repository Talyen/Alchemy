import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import type { Screen } from "@/lib/routing";

/** Resume and live nav share this map so autosave cannot disagree with Wildwood routing. */
export function wildwoodPhaseToScreen(phase: WildwoodDraftState["phase"]): Screen | undefined {
  if (phase === "removal") return "wildwood-removal";
  if (phase === "draft") return "draft-deck";
  if (phase === "battle") return "battle";
  if (phase === "reward") return "rewards";
  return undefined;
}
