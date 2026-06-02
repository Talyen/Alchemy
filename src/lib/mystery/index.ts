export type { MysteryChoice, MysteryEffect, MysteryEvent } from "./types";
export { mysteryPool } from "./pool";

import { pickRandom } from "@/lib/utils";

import { mysteryPool } from "./pool";
import type { MysteryEvent } from "./types";

export function pickMysteryEvent(): MysteryEvent {
  return pickRandom(mysteryPool) ?? mysteryPool[0];
}
