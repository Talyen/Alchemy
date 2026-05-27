// Barrel for mystery event types, pool data, and selection helper.
export type { MysteryChoice, MysteryEffect, MysteryEvent } from "./mystery-event-types";
export { mysteryPool } from "./mystery-pool";

import { pickRandom } from "@/lib/utils";

import { mysteryPool } from "./mystery-pool";
import type { MysteryEvent } from "./mystery-event-types";

export function pickMysteryEvent(): MysteryEvent {
  return pickRandom(mysteryPool) ?? mysteryPool[0];
}
