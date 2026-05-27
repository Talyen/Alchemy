// Aggregated talent pool split by keyword.
import type { TalentDefinition } from "../types";
import { physicalTalents } from "./physical";
import { stunTalents } from "./stun";
import { blockTalents } from "./block";
import { forgeTalents } from "./forge";
import { armorTalents } from "./armor";
import { healthTalents } from "./health";
import { burnTalents } from "./burn";
import { goldTalents } from "./gold";
import { holyTalents } from "./holy";
import { wishTalents } from "./wish";
import { poisonTalents } from "./poison";
import { bleedTalents } from "./bleed";
import { leechTalents } from "./leech";
import { freezeTalents } from "./freeze";
import { manaTalents } from "./mana";
import { natureTalents } from "./nature";
import { companionTalents } from "./companion";
import { arrowTalents } from "./arrow";
import { consumeTalents } from "./consume";

export const talentPool: TalentDefinition[] = [
  ...physicalTalents,
  ...stunTalents,
  ...blockTalents,
  ...forgeTalents,
  ...armorTalents,
  ...healthTalents,
  ...burnTalents,
  ...goldTalents,
  ...holyTalents,
  ...wishTalents,
  ...poisonTalents,
  ...bleedTalents,
  ...leechTalents,
  ...freezeTalents,
  ...manaTalents,
  ...natureTalents,
  ...companionTalents,
  ...arrowTalents,
  ...consumeTalents,
];
