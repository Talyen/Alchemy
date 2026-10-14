export const MANA_DOCK_VISIBLE_COUNT = 9;
export const MANA_DOCK_EXIT_MS = 420;

export type ManaGemEffect = "gain" | "fill" | "spend" | null;

export interface ManaGemPresentation {
  index: number;
  filled: boolean;
  x: number;
  y: number;
  token: number;
  effect: ManaGemEffect;
}

export interface ManaGemExit {
  id: string;
  index: number;
  filled: boolean;
  x: number;
  y: number;
  height: number;
  kind: "destroy" | "fade";
}

export interface ManaPresentation {
  mana: number;
  maxMana: number;
  revision: number;
  height: number;
  gems: ManaGemPresentation[];
  exits: ManaGemExit[];
  hidden: number;
}

/** Coordinates refer to the frame artwork, not the dock's reserved side space. */
export function manaGemPosition(index: number, total: number): number {
  const count = Math.min(total, MANA_DOCK_VISIBLE_COUNT);
  const spacing = Math.min(10.5, 56 / Math.max(1, count - 1));
  return 50 + (index - (count - 1) / 2) * spacing;
}

/** Percentage of frame height; common three/four-crystal rows keep the largest size. */
export function manaGemHeight(total: number): number {
  return 30 - Math.max(0, Math.min(total, MANA_DOCK_VISIBLE_COUNT) - 4) * 1.6;
}

/** Derive visual changes without changing gameplay or inventing resource events. */
export function projectMana(
  previous: ManaPresentation | null,
  mana: number,
  maxMana: number,
  animate = true,
): ManaPresentation {
  const total = Math.max(mana, maxMana);
  const count = Math.min(total, MANA_DOCK_VISIBLE_COUNT);
  const revision = (previous?.revision ?? 0) + 1;
  const motion = animate && previous !== null;
  const gems = Array.from({ length: count }, (_, index): ManaGemPresentation => {
    const old = previous?.gems[index];
    const filled = index < mana;
    let effect: ManaGemEffect = null;
    if (motion) {
      if (index >= previous.maxMana && index < maxMana) effect = "gain";
      else if (!old || old.filled !== filled) effect = filled ? "fill" : "spend";
    }
    const x = manaGemPosition(index, total);
    return {
      index,
      filled,
      x,
      y: 46 + 5 * ((x - 50) / 28) ** 2,
      token: effect ? revision : (old?.token ?? 0),
      effect: motion ? (effect ?? old?.effect ?? null) : null,
    };
  });
  const exits: ManaGemExit[] = motion
    ? [
        ...previous.exits.filter((exit) => exit.index >= count),
        ...previous.gems
          .filter((gem) => gem.index >= count)
          .map(
            (gem): ManaGemExit => ({
              id: `mana-exit-${revision}-${gem.index}`,
              index: gem.index,
              filled: gem.filled,
              x: gem.x,
              y: gem.y,
              height: previous.height,
              // Bonus mana fading away is not the destruction of permanent capacity.
              kind: gem.index < previous.maxMana && gem.index >= maxMana ? "destroy" : "fade",
            }),
          ),
      ].slice(-MANA_DOCK_VISIBLE_COUNT)
    : [];
  return { mana, maxMana, revision, height: manaGemHeight(total), gems, exits, hidden: Math.max(0, total - count) };
}
