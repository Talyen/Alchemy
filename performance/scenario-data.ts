/**
 * Perf scenario decks / inventories.
 *
 * Use real `cardLibrary` ids so in-app `hydrateCard` restores production art URLs.
 * Do not import `@/lib/game-data` here — that pulls webp assets into Playwright discovery.
 * Fake E2E ids (`spark`, `placeholder` art) leave cards blank and understate paint cost.
 */
import type { GearInstance } from "@/lib/gear/types";

interface PerfCard {
  id: string;
  title: string;
  descriptionLines: string[];
  art: string;
  cost: number;
  effects: Array<Record<string, unknown>>;
  consume?: boolean;
}

function libraryCard(
  id: string,
  title: string,
  effects: Array<Record<string, unknown>>,
  options: { cost?: number; consume?: boolean; descriptionLines?: string[] } = {},
): PerfCard {
  return {
    id,
    title,
    // Empty art: hydrateCard merges the live library entry (correct hashed asset URL).
    art: "",
    cost: options.cost ?? 1,
    descriptionLines: options.descriptionLines ?? [title],
    effects,
    ...(options.consume !== undefined ? { consume: options.consume } : {}),
  };
}

/**
 * Dense FX deck: multi-hit / multi-type cards so one turn can emit many combat
 * texts (different damage types, heals, statuses) overlapping. Cost 0 so the
 * harness can empty a hand before ending the turn without mana gating.
 * Damage stays low so the fight lasts through a full measured window.
 */
export function effectHeavyDeck(): PerfCard[] {
  return [
    libraryCard(
      "hemorrhage",
      "Hemorrhage",
      [
        { kind: "damage", damageType: "physical", amount: 1 },
        { kind: "damage", damageType: "bleed", amount: 1 },
      ],
      { cost: 0, descriptionLines: ["Deal 1 Physical damage", "Deal 1 Bleed damage"] },
    ),
    libraryCard(
      "smite",
      "Smite",
      [
        { kind: "damage", damageType: "holy", amount: 1 },
        { kind: "damage", damageType: "burn", amount: 1 },
      ],
      { cost: 0, descriptionLines: ["Deal 1 Holy damage", "Deal 1 Burn damage"] },
    ),
    libraryCard(
      "cinderbloom",
      "Cinderbloom",
      [
        { kind: "damage", damageType: "nature", amount: 1 },
        { kind: "damage", damageType: "burn", amount: 1 },
      ],
      { cost: 0, descriptionLines: ["Deal 1 Nature damage", "Deal 1 Burn damage"] },
    ),
    libraryCard(
      "grasping-vines",
      "Grasping Vines",
      [
        { kind: "damage", damageType: "nature", amount: 1 },
        { kind: "damage", damageType: "stun", amount: 1 },
      ],
      { cost: 0, descriptionLines: ["Deal 1 Nature damage", "Deal 1 Stun damage"] },
    ),
    libraryCard(
      "burning-blade",
      "Burning Blade",
      [
        { kind: "damage", damageType: "physical", amount: 1 },
        { kind: "damage", damageType: "burn", amount: 1 },
      ],
      { cost: 0, descriptionLines: ["Deal 1 Physical damage", "Deal 1 Burn damage"] },
    ),
    libraryCard(
      "judgment",
      "Judgment",
      [
        { kind: "damage", damageType: "holy", amount: 1 },
        { kind: "damage", damageType: "stun", amount: 1 },
      ],
      { cost: 0, descriptionLines: ["Deal 1 Holy damage", "Deal 1 Stun damage"] },
    ),
    libraryCard(
      "sunburst",
      "Sunburst",
      [
        { kind: "heal", amount: 2 },
        { kind: "damage", damageType: "burn", amount: 1 },
      ],
      { cost: 0, descriptionLines: ["Restore 2 Health", "Deal 1 Burn damage"] },
    ),
    libraryCard(
      "holy-radiance",
      "Holy Radiance",
      [
        { kind: "heal", amount: 2 },
        { kind: "damage", damageType: "holy", amount: 1 },
      ],
      { cost: 0, descriptionLines: ["Restore 2 Health", "Deal 1 Holy damage"] },
    ),
    libraryCard("frostbolt", "Frostbolt", [{ kind: "damage", damageType: "freeze", amount: 1 }], {
      cost: 0,
      descriptionLines: ["Deal 1 Freeze damage"],
    }),
    libraryCard("poison-dagger", "Poison Dagger", [{ kind: "damage", damageType: "poison", amount: 1 }], {
      cost: 0,
      descriptionLines: ["Deal 1 Poison damage"],
    }),
    libraryCard("block", "Block", [{ kind: "player-status", status: "block", amount: 5 }], {
      cost: 0,
      descriptionLines: ["Gain 5 Block"],
    }),
    libraryCard("wolf-companion", "Wolf", [{ kind: "summon-companion", companionId: "wolf" }], {
      cost: 0,
      descriptionLines: ["Summon a wolf ally"],
    }),
  ];
}

/** Weak slash deck for end-turn transition measurement (not FX density). */
export function weakEndTurnDeck(): PerfCard[] {
  return Array.from({ length: 6 }, () =>
    libraryCard("slash", "Slash", [{ kind: "damage", damageType: "physical", amount: 1 }], {
      cost: 0,
      descriptionLines: ["Deal 1 Physical damage"],
    }),
  );
}

const INVENTORY_DEFS = [
  "leather-armor-basic",
  "ruby-ring-basic",
  "leather-buckler-basic",
  "shortsword-basic",
  "longbow-basic",
  "leather-armor-astral",
  "plate-armor-basic",
  "dagger-basic",
  "mace-basic",
  "sapphire-ring-basic",
  "longsword-basic",
  "staff-basic",
  "emerald-amulet-basic",
] as const;

/** Large but realistic Armory inventory for scroll/drag measurement. */
export function largeArmoryInventory(count = 36): GearInstance[] {
  const items: GearInstance[] = [];
  for (let i = 0; i < count; i++) {
    const definitionId = INVENTORY_DEFS[i % INVENTORY_DEFS.length]!;
    items.push({
      instanceId: `perf-gear-${i}`,
      definitionId,
      affixes: [],
    });
  }
  return items;
}
