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
import type { createCollector } from "./utils";
import type { ContentValidationArea } from "./types";

const EM_DASH = "\u2014";

function hasEmDash(text: string): boolean {
  return text.includes(EM_DASH);
}

function hasPeriod(text: string): boolean {
  return text.includes(".");
}

function checkNoPeriod(
  collector: ReturnType<typeof createCollector>,
  group: ContentValidationArea,
  id: string,
  label: string,
  text: string,
): void {
  if (hasPeriod(text)) {
    collector.error(group, id, `${label} contains a period — rewrite without periods: "${text}"`);
  }
}

function checkTextTypography(
  collector: ReturnType<typeof createCollector>,
  group: ContentValidationArea,
  id: string,
  label: string,
  text: string,
  options?: { allowPeriod?: boolean; sliceLimit?: number },
): void {
  if (hasEmDash(text)) {
    const snippet = options?.sliceLimit ? text.slice(0, options.sliceLimit) : text;
    collector.error(group, id, `${label} contains em dash — rewrite without —: "${snippet}"`);
  }
  if (!options?.allowPeriod) {
    checkNoPeriod(collector, group, id, label, text);
  }
}

export function validateTypography(collector: ReturnType<typeof createCollector>): void {
  for (const event of mysteryPool) {
    checkTextTypography(collector, "rewards", event.id, "Mystery title", event.title, { allowPeriod: true });
    checkTextTypography(collector, "rewards", event.id, "Mystery narrative", event.narrative, {
      allowPeriod: true,
      sliceLimit: 80,
    });
    for (const choice of event.choices) {
      checkTextTypography(collector, "rewards", `${event.id}/${choice.label}`, "Mystery choice label", choice.label, {
        allowPeriod: true,
      });
    }
  }

  for (const card of cardLibrary) {
    checkTextTypography(collector, "cards", card.id, "Card title", card.title, { allowPeriod: true });
    for (const line of card.descriptionLines) {
      checkTextTypography(collector, "cards", card.id, "Card description", line);
    }
  }

  for (const trinket of trinketLibrary) {
    checkTextTypography(collector, "trinkets", trinket.id, "Trinket title", trinket.title, { allowPeriod: true });
    for (const line of trinket.descriptionLines) {
      checkTextTypography(collector, "trinkets", trinket.id, "Trinket description", line);
    }
  }

  for (const enemy of enemyBestiary) {
    checkTextTypography(collector, "enemies", enemy.id, "Enemy title", enemy.title, { allowPeriod: true });
    checkTextTypography(collector, "enemies", enemy.id, "Enemy subtitle", enemy.subtitle, { allowPeriod: true });
    for (const trait of enemy.traits) {
      checkTextTypography(collector, "enemies", trait.id, "Enemy trait title", trait.title, { allowPeriod: true });
      checkTextTypography(collector, "enemies", trait.id, "Enemy trait description", trait.description);
    }
  }

  for (const [id, companion] of Object.entries(companionLibrary)) {
    checkTextTypography(collector, "companions", id, "Companion title", companion.title, { allowPeriod: true });
  }

  for (const definition of gearDefinitionList) {
    for (const line of definition.descriptionLines) {
      checkTextTypography(collector, "gear", definition.id, "Gear description", line, {
        allowPeriod: definition.rarity === "unique",
      });
    }
    checkTextTypography(collector, "gear", definition.id, "Gear id", definition.id, { allowPeriod: true });
  }

  for (const [id, character] of Object.entries(characters)) {
    checkTextTypography(collector, "keywords", id, "Character name", character.name, { allowPeriod: true });
    checkTextTypography(collector, "keywords", id, "Character description", character.description, {
      allowPeriod: true,
    });
    checkTextTypography(collector, "keywords", id, "Character role", character.role, { allowPeriod: true });
  }

  for (const talent of talentPool) {
    checkTextTypography(collector, "talents", talent.id, "Talent description", talent.description);
  }

  for (const [id, definition] of Object.entries(keywordDefinitions)) {
    checkTextTypography(collector, "keywords", id, "Keyword label", definition.label, { allowPeriod: true });
    checkTextTypography(collector, "keywords", id, "Keyword description", definition.description);
  }

  for (const [id, trait] of Object.entries(ENCOUNTER_TRAITS)) {
    checkTextTypography(collector, "encounter-traits", id, "Encounter trait label", trait.label, {
      allowPeriod: true,
    });
    checkTextTypography(collector, "encounter-traits", id, "Encounter trait description", trait.description);
    checkTextTypography(collector, "encounter-traits", id, "Encounter trait enemy title", trait.enemyTrait.title, {
      allowPeriod: true,
    });
    checkTextTypography(
      collector,
      "encounter-traits",
      id,
      "Encounter trait enemy description",
      trait.enemyTrait.description,
    );
  }

  for (const affix of gearAffixList) {
    if (!affix.uniqueOnly) {
      checkNoPeriod(collector, "gear", affix.id, "Gear affix description", affix.descriptionTemplate);
    }
  }
}
