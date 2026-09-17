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
  options?: { allowPeriod?: boolean; sliceLimit?: number },
): void {
  if (text.includes(EM_DASH)) {
    const snippet = options?.sliceLimit ? text.slice(0, options.sliceLimit) : text;
    collector.error(group, id, `${label} contains em dash — rewrite without —: "${snippet}"`);
  }
  if (!options?.allowPeriod) {
    checkNoPeriod(collector, group, id, label, text);
  }
}

interface TypographyEntry {
  area: ContentValidationArea;
  id: string;
  label: string;
  text: string;
  allowPeriod?: boolean;
  sliceLimit?: number;
}

// Style policy: description lines stay period-free for inline display; titles
// and narrative may use periods. Exceptions: unique-rarity gear descriptions
// (flavor text) and unique-only affix templates (checked separately below).
function* collectTypographyEntries(): Generator<TypographyEntry> {
  for (const event of mysteryPool) {
    yield { area: "rewards", id: event.id, label: "Mystery title", text: event.title, allowPeriod: true };
    yield {
      area: "rewards",
      id: event.id,
      label: "Mystery narrative",
      text: event.narrative,
      allowPeriod: true,
      sliceLimit: 80,
    };
    for (const choice of event.choices) {
      yield {
        area: "rewards",
        id: `${event.id}/${choice.label}`,
        label: "Mystery choice label",
        text: choice.label,
        allowPeriod: true,
      };
    }
  }

  for (const card of cardLibrary) {
    yield { area: "cards", id: card.id, label: "Card title", text: card.title, allowPeriod: true };
    for (const line of card.descriptionLines) {
      yield { area: "cards", id: card.id, label: "Card description", text: line };
    }
  }

  for (const trinket of trinketLibrary) {
    yield { area: "trinkets", id: trinket.id, label: "Trinket title", text: trinket.title, allowPeriod: true };
    for (const line of trinket.descriptionLines) {
      yield { area: "trinkets", id: trinket.id, label: "Trinket description", text: line };
    }
  }

  for (const enemy of enemyBestiary) {
    yield { area: "enemies", id: enemy.id, label: "Enemy title", text: enemy.title, allowPeriod: true };
    yield { area: "enemies", id: enemy.id, label: "Enemy subtitle", text: enemy.subtitle, allowPeriod: true };
    for (const trait of enemy.traits) {
      yield { area: "enemies", id: trait.id, label: "Enemy trait title", text: trait.title, allowPeriod: true };
      yield { area: "enemies", id: trait.id, label: "Enemy trait description", text: trait.description };
    }
  }

  for (const [id, companion] of Object.entries(companionLibrary)) {
    yield { area: "companions", id, label: "Companion title", text: companion.title, allowPeriod: true };
  }

  for (const definition of gearDefinitionList) {
    for (const line of definition.descriptionLines) {
      yield {
        area: "gear",
        id: definition.id,
        label: "Gear description",
        text: line,
        allowPeriod: definition.rarity === "unique",
      };
    }
  }

  for (const [id, character] of Object.entries(characters)) {
    yield { area: "keywords", id, label: "Character name", text: character.name, allowPeriod: true };
    yield { area: "keywords", id, label: "Character role", text: character.role, allowPeriod: true };
  }

  for (const talent of talentPool) {
    yield { area: "talents", id: talent.id, label: "Talent description", text: talent.description };
  }

  for (const [id, definition] of Object.entries(keywordDefinitions)) {
    yield { area: "keywords", id, label: "Keyword label", text: definition.label, allowPeriod: true };
    yield { area: "keywords", id, label: "Keyword description", text: definition.description };
  }

  for (const [id, trait] of Object.entries(ENCOUNTER_TRAITS)) {
    yield { area: "encounter-traits", id, label: "Encounter trait label", text: trait.label, allowPeriod: true };
    yield { area: "encounter-traits", id, label: "Encounter trait description", text: trait.description };
    yield {
      area: "encounter-traits",
      id,
      label: "Encounter trait enemy title",
      text: trait.enemyTrait.title,
      allowPeriod: true,
    };
    yield {
      area: "encounter-traits",
      id,
      label: "Encounter trait enemy description",
      text: trait.enemyTrait.description,
    };
  }
}

export function validateTypography(collector: Collector): void {
  for (const entry of collectTypographyEntries()) {
    const options: { allowPeriod?: boolean; sliceLimit?: number } = {};
    if (entry.allowPeriod !== undefined) options.allowPeriod = entry.allowPeriod;
    if (entry.sliceLimit !== undefined) options.sliceLimit = entry.sliceLimit;
    checkTextTypography(collector, entry.area, entry.id, entry.label, entry.text, options);
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
