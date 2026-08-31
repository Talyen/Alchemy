import {
  cardLibrary,
  trinketLibrary,
  enemyBestiary,
  characters,
  talentPool,
  companionLibrary,
  keywordDefinitions,
} from "@/lib/game-data";
import { gearDefinitionList } from "@/lib/gear";
import { mysteryPool } from "@/lib/mystery/pool";
import { ENCOUNTER_TRAITS } from "../content-systems/encounter-traits";
import type { createCollector } from "./utils";

const EM_DASH = "\u2014";

function hasEmDash(text: string): boolean {
  return text.includes(EM_DASH);
}

export function validateTypography(collector: ReturnType<typeof createCollector>): void {
  for (const event of mysteryPool) {
    if (hasEmDash(event.title)) {
      collector.error("rewards", event.id, `Mystery title contains em dash — rewrite without —: "${event.title}"`);
    }
    if (hasEmDash(event.narrative)) {
      collector.error(
        "rewards",
        event.id,
        `Mystery narrative contains em dash — rewrite without —: "${event.narrative.slice(0, 80)}"`,
      );
    }
    for (const choice of event.choices) {
      if (hasEmDash(choice.label)) {
        collector.error(
          "rewards",
          `${event.id}/${choice.label}`,
          `Mystery choice label contains em dash — rewrite without —: "${choice.label}"`,
        );
      }
    }
  }

  for (const card of cardLibrary) {
    if (hasEmDash(card.title)) {
      collector.error("cards", card.id, `Card title contains em dash — rewrite without —: "${card.title}"`);
    }
    for (const line of card.descriptionLines) {
      if (hasEmDash(line)) {
        collector.error("cards", card.id, `Card description contains em dash — rewrite without —: "${line}"`);
      }
    }
  }

  for (const trinket of trinketLibrary) {
    if (hasEmDash(trinket.title)) {
      collector.error("trinkets", trinket.id, `Trinket title contains em dash — rewrite without —: "${trinket.title}"`);
    }
    for (const line of trinket.descriptionLines) {
      if (hasEmDash(line)) {
        collector.error("trinkets", trinket.id, `Trinket description contains em dash — rewrite without —: "${line}"`);
      }
    }
  }

  for (const enemy of enemyBestiary) {
    if (hasEmDash(enemy.title)) {
      collector.error("enemies", enemy.id, `Enemy title contains em dash — rewrite without —: "${enemy.title}"`);
    }
    if (hasEmDash(enemy.subtitle)) {
      collector.error("enemies", enemy.id, `Enemy subtitle contains em dash — rewrite without —: "${enemy.subtitle}"`);
    }
    for (const trait of enemy.traits) {
      if (hasEmDash(trait.title)) {
        collector.error(
          "enemies",
          trait.id,
          `Enemy trait title contains em dash — rewrite without —: "${trait.title}"`,
        );
      }
      if (hasEmDash(trait.description)) {
        collector.error(
          "enemies",
          trait.id,
          `Enemy trait description contains em dash — rewrite without —: "${trait.description}"`,
        );
      }
    }
  }

  for (const [id, companion] of Object.entries(companionLibrary)) {
    if (hasEmDash(companion.title)) {
      collector.error("companions", id, `Companion title contains em dash — rewrite without —: "${companion.title}"`);
    }
  }

  for (const definition of gearDefinitionList) {
    for (const line of definition.descriptionLines) {
      if (hasEmDash(line)) {
        collector.error("gear", definition.id, `Gear description contains em dash — rewrite without —: "${line}"`);
      }
    }
    if (hasEmDash(definition.id)) {
      collector.error("gear", definition.id, `Gear id contains em dash — rewrite without —: "${definition.id}"`);
    }
  }

  for (const [id, character] of Object.entries(characters)) {
    if (hasEmDash(character.name)) {
      collector.error("keywords", id, `Character name contains em dash — rewrite without —: "${character.name}"`);
    }
    if (hasEmDash(character.description)) {
      collector.error(
        "keywords",
        id,
        `Character description contains em dash — rewrite without —: "${character.description}"`,
      );
    }
    if (hasEmDash(character.role)) {
      collector.error("keywords", id, `Character role contains em dash — rewrite without —: "${character.role}"`);
    }
  }

  for (const talent of talentPool) {
    if (hasEmDash(talent.description)) {
      collector.error(
        "talents",
        talent.id,
        `Talent description contains em dash — rewrite without —: "${talent.description}"`,
      );
    }
  }

  for (const [id, definition] of Object.entries(keywordDefinitions)) {
    if (hasEmDash(definition.label)) {
      collector.error("keywords", id, `Keyword label contains em dash — rewrite without —: "${definition.label}"`);
    }
    if (hasEmDash(definition.description)) {
      collector.error(
        "keywords",
        id,
        `Keyword description contains em dash — rewrite without —: "${definition.description}"`,
      );
    }
  }

  for (const [id, trait] of Object.entries(ENCOUNTER_TRAITS)) {
    if (hasEmDash(trait.label)) {
      collector.error(
        "encounter-traits",
        id,
        `Encounter trait label contains em dash — rewrite without —: "${trait.label}"`,
      );
    }
    if (hasEmDash(trait.description)) {
      collector.error(
        "encounter-traits",
        id,
        `Encounter trait description contains em dash — rewrite without —: "${trait.description}"`,
      );
    }
    if (hasEmDash(trait.enemyTrait.title)) {
      collector.error(
        "encounter-traits",
        id,
        `Encounter trait enemy title contains em dash — rewrite without —: "${trait.enemyTrait.title}"`,
      );
    }
    if (hasEmDash(trait.enemyTrait.description)) {
      collector.error(
        "encounter-traits",
        id,
        `Encounter trait enemy description contains em dash — rewrite without —: "${trait.enemyTrait.description}"`,
      );
    }
  }
}
