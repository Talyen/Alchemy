import { materialLabels } from "../homestead/types";
import { keywordAliasMap, keywordPattern, keywordAliases } from "../keyword-text";
import type { KeywordId } from "./types";

interface DescriptionMessage {
  id: string;
  template: string;
  slots: Record<string, { magnitudeId: string } | { keywordId: KeywordId } | { resourceId: string }>;
}
export interface DescriptionMessageValue extends DescriptionMessage {
  values: Record<string, string | number>;
}

/** Stable template identity; callers reject collisions when assembling catalogs. */
function descriptionMessageId(template: string): string {
  let first = 2166136261;
  let second = 5381;
  for (let index = 0; index < template.length; index++) {
    first = Math.imul(first ^ template.charCodeAt(index), 16777619);
    second = Math.imul(second, 33) ^ template.charCodeAt(index);
  }
  return `description.${(first >>> 0).toString(16)}${(second >>> 0).toString(16)}`;
}

const CANONICAL_KEYWORDS = new Map(keywordAliases.map((alias) => [alias.match.toLowerCase(), alias.match]));
const RESOURCE_IDS = new Map(
  Object.entries({ ...materialLabels, gold: "Gold" }).map(([id, label]) => [label.toLowerCase(), id]),
);
const RESOURCE_PATTERN = new RegExp(`\\b(${[...RESOURCE_IDS.keys()].join("|")})\\b|${keywordPattern.source}`, "gi");

export function buildDescriptionMessage(
  parts: ReadonlyArray<{ text: string; magnitudeId?: string }>,
  resources = false,
): DescriptionMessageValue {
  const slots: DescriptionMessage["slots"] = {};
  const values: DescriptionMessageValue["values"] = {};
  const pattern = resources ? RESOURCE_PATTERN : keywordPattern;
  let resourceIndex = 0;
  let keywordIndex = 0;
  let magnitudeIndex = 0;
  let valueIndex = 0;
  const source = parts
    .map((part) => {
      const words = part.text.replace(pattern, (word) => {
        const normalizedWord = word.toLowerCase();
        const resourceId = resources ? RESOURCE_IDS.get(normalizedWord) : undefined;
        if (resourceId) {
          const name = `resource${resourceIndex++}`;
          slots[name] = { resourceId };
          return `<${name}>${word}</${name}>`;
        }
        const keywordId = keywordAliasMap.get(normalizedWord);
        if (!keywordId) return word;
        const name = `keyword${keywordIndex++}`;
        slots[name] = { keywordId };
        return `<${name}>${CANONICAL_KEYWORDS.get(normalizedWord) ?? word}</${name}>`;
      });
      if (!part.magnitudeId) return words;
      const name = `magnitude${magnitudeIndex++}`;
      slots[name] = { magnitudeId: part.magnitudeId };
      return `<${name}>${words}</${name}>`;
    })
    .join("");
  // Numbers in explanatory prose are presentation values, never editable effect
  // references. Keep tag names intact while parameterizing these values too.
  const template = source
    .split(/(<[^>]+>)/g)
    .map((part) =>
      part.startsWith("<")
        ? part
        : part.replace(/\d+(?:\.\d+)?/g, (value) => {
            const name = `value${valueIndex++}`;
            values[name] = Number(value);
            return `{{${name}}}`;
          }),
    )
    .join("");
  return { id: descriptionMessageId(template), template, slots, values };
}
