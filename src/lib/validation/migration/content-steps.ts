// Content-id remaps must stay tiny: this walk deep-clones the whole save per
// applicable version, so a large table should become targeted path rewrites.
const CONTENT_ID_REMAPS_BY_VERSION: Array<{ toVersion: number; remaps: Record<string, string> }> = [
  { toVersion: 2, remaps: { "sunder-armor": "sunder" } },
  { toVersion: 3, remaps: { roulette: "roll-the-dice" } },
];

const CARD_ID_KEYS = new Set([
  "id",
  "cardId",
  "cardIds",
  "chosenCardId",
  "choiceIds",
  "rewardChoiceIds",
  "selectedRewardId",
  "selectedId",
  "companionChoiceIds",
  "discoveredCardIds",
]);
// Note: rewardGearChoices intentionally excluded (gear instances, not card ids).
// rewardChoiceIds/selectedRewardId can also hold boon or trinket ids (see the
// wildwoodDraft rewardType branches in steps-v12-v13); they are covered here
// for card rewards, so future remap keys must avoid the boon/trinket namespaces.

function isCardIdPosition(key: string): boolean {
  return CARD_ID_KEYS.has(key);
}

function remapContentIds(value: unknown, remaps: Record<string, string>, idPosition: boolean): unknown {
  if (Array.isArray(value)) return value.map((item) => remapContentIds(item, remaps, idPosition));
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      next[key] = remapContentIds(nested, remaps, isCardIdPosition(key));
    }
    return next;
  }
  if (typeof value === "string") return idPosition ? (remaps[value] ?? value) : value;
  return value;
}

export function migrateContentToCurrentVersion(
  parsed: Record<string, unknown>,
  fromVersion: number,
): Record<string, unknown> {
  let next = parsed;
  for (const step of CONTENT_ID_REMAPS_BY_VERSION) {
    if (fromVersion < step.toVersion) next = remapContentIds(next, step.remaps, false) as Record<string, unknown>;
  }
  return next;
}
