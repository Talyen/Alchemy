// Shared card description-line classifiers: the single definition of "what does
// a line of type T look like?" for card text↔effects parity.
//
// Count parity (index.ts) and numeric parity (numeric-parity.ts) must agree on
// these families, or count parity passes while numeric parity silently skips
// (or vice versa). Both modules import from here.
//
// Two intentional divergences remain, documented at their numeric checkers:
// - Gold and restore-mana numeric gates are prefix-based while the count
//   predicates below match looser phrasing; the numeric side handles fewer
//   shapes by design (unmatched lines fall through unchecked).
// - Heal counts accept "Heal "/"Gain ... Health" phrasing, but numeric value
//   checks only cover "Restore X Health" (the only phrasing in the catalog).

export const RANDOM_DRAW_LINE = "Draw that many cards";
export const DIE_ROLL_LINE = "Roll a six-sided die";

export function isHealLine(line: string): boolean {
  return (
    line.startsWith("Heal ") ||
    (line.startsWith("Restore ") && line.includes("Health")) ||
    (line.startsWith("Gain ") && line.includes("Health"))
  );
}

export function isRestoreManaLine(line: string): boolean {
  return (
    (line.includes("Restore ") || line.includes("Gain ")) &&
    line.includes("Mana") &&
    !line.includes("Health") &&
    !line.includes("Mana Crystal") &&
    !line.includes("Maximum Mana")
  );
}

const GOLD_LINE_PATTERN = /\b(?:gain|steal)s? \d+(?:\s+[^,]+,)?\s+Gold\b/i;

export function isGoldLine(line: string): boolean {
  return !line.startsWith("Deals ") && GOLD_LINE_PATTERN.test(line);
}

export function isWishLine(line: string): boolean {
  return (
    line.startsWith("Wish ") || line.endsWith(" or Wish") || line === "If you don't have a Companion, Wish for one"
  );
}

export function isRemoveHarmfulStatusLine(line: string): boolean {
  return (line.startsWith("Remove ") || line.startsWith("Cleanse ")) && line.includes("harmful status");
}

export function isLoseMaxManaLine(line: string): boolean {
  return line.startsWith("Lose ") && line.includes("Mana Crystal");
}

const GAIN_MAX_MANA_PATTERN = /^Gain \d+ (?:Maximum Mana|Mana Crystals?)(?:$| )/;

export function isGainMaxManaLine(line: string): boolean {
  return GAIN_MAX_MANA_PATTERN.test(line);
}

export function isLoseHealthLine(line: string): boolean {
  return line.startsWith("Lose ") && line.includes("Health");
}

export function isDrawLine(line: string): boolean {
  return line.startsWith("Draw ") && line !== RANDOM_DRAW_LINE;
}

export function isRandomDrawLine(line: string): boolean {
  return line === RANDOM_DRAW_LINE;
}

export function isDieRollLine(line: string): boolean {
  return line === DIE_ROLL_LINE;
}

export function isCompanionActionLine(line: string): boolean {
  return line.startsWith("Your Companion acts ");
}

export function isRemoveEnemyArmorLine(line: string): boolean {
  return (
    line.startsWith("Halve enemy Armor") ||
    line.startsWith("Strip ") ||
    (line.startsWith("Remove ") && line.includes("enemy Armor"))
  );
}

export function isDoubleLine(line: string): boolean {
  return line.startsWith("Double ");
}

export function isCleanseLine(line: string): boolean {
  return line.startsWith("Cleanse ") && !line.includes("harmful status");
}

export function cleanseLineEffectCount(line: string): number {
  return line === "Cleanse Stun and Freeze build-up" ? 2 : isCleanseLine(line) ? 1 : 0;
}

export function isBlockLine(line: string): boolean {
  return (
    (line.startsWith("Gain ") || / or gain /i.test(line)) &&
    line.includes(" Block") &&
    !line.includes("per Mana Crystal") &&
    !line.endsWith("each turn")
  );
}

export function isConvertManaBlockLine(line: string): boolean {
  return line.includes("Convert each of your Mana into");
}

export function isPerManaBlockLine(line: string): boolean {
  return line.includes("per Mana Crystal");
}

export function isGainStatusLine(line: string, name: string): boolean {
  return line.startsWith("Gain ") && line.includes(` ${name}`);
}

export interface DealLineShape {
  twice: boolean;
  delayedSecondAmount: number | null;
  sharedDelayed: boolean;
}

// Single owner for "Deal ..." delayed/repeat phrasing, shared by count parity
// (twice counts two hits) and numeric parity (delayed lines consume two damage
// cursors, the second against the delayed amount). Returns null for non-Deal
// lines. Lines with "equal to" or "random" are still Deal lines here; callers
// exclude them from value/count checks via isNonStandardDealLine.
export function parseDealLineShape(line: string): DealLineShape | null {
  if (!line.startsWith("Deal ")) return null;
  const delayed = / now and (\d+) at the start of your next turn$/.exec(line);
  return {
    twice: line.includes("twice"),
    delayedSecondAmount: delayed ? Number(delayed[1]) : null,
    sharedDelayed: line.endsWith(" now and at the start of your next turn"),
  };
}

export function isNonStandardDealLine(line: string): boolean {
  return line.includes("equal to") || line.toLowerCase().includes("random");
}
