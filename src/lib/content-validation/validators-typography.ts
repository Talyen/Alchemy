import {
  cardLibrary,
  trinketLibrary,
  enemyBestiary,
  characters,
  talentPool,
  companionLibrary,
  keywordDefinitions,
} from "@/lib/game-data";
import { gearAffixList, gearDefinitionList } from "@/lib/gear";
import { mysteryPool } from "@/lib/mystery/pool";
import { ENCOUNTER_TRAITS } from "../content-systems/encounter-traits";
import type { Collector } from "./utils";
import type { ContentValidationArea } from "./types";

const EM_DASH = "\u2014";

function checkNoPeriod(
  collector: Collector,
  group: ContentValidationArea,
  id: string,
  label: string,
  text: string,
): void {
  if (text.includes(".")) {
    collector.error(group, id, `${label} contains a period — rewrite without periods: "${text}"`);
  }
}

function checkTextTypography(
  collector: Collector,
  group: ContentValidationArea,
  id: string,
  label: string,
  text: string,
  allowPeriod = false,
): void {
  if (text.includes(EM_DASH)) {
    collector.error(group, id, `${label} contains em dash — rewrite without —: "${text}"`);
  }
  if (!allowPeriod) {
    checkNoPeriod(collector, group, id, label, text);
  }
}

// Style policy: description lines stay period-free for inline display; titles
// and narrative may use periods. Exceptions: unique-rarity gear descriptions
// (flavor text) and unique-only affix templates (checked separately below).
export function validateTypography(collector: Collector): void {
  const check = (group: ContentValidationArea, id: string, label: string, text: string, allowPeriod = false): void =>
    checkTextTypography(collector, group, id, label, text, allowPeriod);
  for (const event of mysteryPool) {
    check("rewards", event.id, "Mystery title", event.title, true);
    check("rewards", event.id, "Mystery narrative", event.narrative, true);
    for (const choice of event.choices) {
      check("rewards", `${event.id}/${choice.label}`, "Mystery choice label", choice.label, true);
    }
  }

  for (const [area, label, entries] of [
    ["cards", "Card", cardLibrary],
    ["trinkets", "Trinket", trinketLibrary],
  ] as const) {
    for (const entry of entries) {
      check(area, entry.id, `${label} title`, entry.title, true);
      for (const line of entry.descriptionLines) check(area, entry.id, `${label} description`, line);
    }
  }

  for (const enemy of enemyBestiary) {
    check("enemies", enemy.id, "Enemy title", enemy.title, true);
    check("enemies", enemy.id, "Enemy subtitle", enemy.subtitle, true);
    for (const trait of enemy.traits) {
      check("enemies", trait.id, "Enemy trait title", trait.title, true);
      check("enemies", trait.id, "Enemy trait description", trait.description);
    }
  }

  for (const [id, companion] of Object.entries(companionLibrary)) {
    check("companions", id, "Companion title", companion.title, true);
  }

  for (const definition of gearDefinitionList) {
    for (const line of definition.descriptionLines) {
      check("gear", definition.id, "Gear description", line, definition.rarity === "unique");
    }
  }

  for (const [id, character] of Object.entries(characters)) {
    check("keywords", id, "Character name", character.name, true);
    check("keywords", id, "Character role", character.role, true);
  }

  for (const talent of talentPool) {
    check("talents", talent.id, "Talent description", talent.description);
  }

  for (const [id, definition] of Object.entries(keywordDefinitions)) {
    check("keywords", id, "Keyword label", definition.label, true);
    // The approved Forge tooltip is a full sentence; retain its terminal period.
    const description = id === "forge" ? definition.description.replace(/\.$/u, "") : definition.description;
    check("keywords", id, "Keyword description", description);
  }

  for (const [id, trait] of Object.entries(ENCOUNTER_TRAITS)) {
    check("encounter-traits", id, "Encounter trait label", trait.label, true);
    check("encounter-traits", id, "Encounter trait description", trait.description);
    check("encounter-traits", id, "Encounter trait enemy title", trait.enemyTrait.title, true);
    check("encounter-traits", id, "Encounter trait enemy description", trait.enemyTrait.description);
  }
  for (const affix of gearAffixList) {
    // Unique-only affix templates render with flavor punctuation and skip the
    // em-dash check entirely; only shared pool templates must stay
    // period-free for inline display.
    if (!affix.uniqueOnly) {
      checkNoPeriod(collector, "gear", affix.id, "Gear affix description", affix.descriptionTemplate);
    }
  }
}
