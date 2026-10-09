import type { PersistedRunActivity } from "@/lib/active-run-session/types";

const DEFAULT_MYSTERY_EVENT = {
  id: "ancient-altar",
  title: "Ancient Altar",
  description:
    "A weathered stone altar stands beneath a shaft of light piercing the canopy. Gold fills a rusted offering bowl, and a topaz relic set with crystal rests beside it.",
  choices: [
    {
      label: "Take the Offering",
      outcomes: [
        { kind: "grant-xp", keyword: "holy", amount: 1 },
        { kind: "grant-gear", gearId: "topaz-ring" },
        { kind: "grant-gold", amount: 20 },
      ],
    },
    {
      label: "Claim the Relic",
      outcomes: [
        { kind: "grant-xp", keyword: "holy", amount: 1 },
        { kind: "grant-gear", gearId: "topaz-amulet" },
        { kind: "grant-material", materialId: "gems", amount: 1 },
      ],
    },
  ],
};

const DEFAULT_BATTLE_STATE = {
  deck: [],
  hand: [],
  pendingHandCards: [],
  discard: [],
  exhausted: [],
  mana: 0,
  maxMana: 0,
  gold: 0,
  turn: 1,
  turnPhase: "player",
  playerHealth: 30,
  playerMaxHealth: 30,
  playerDodgeCount: 0,
  dodgeChanceFromDamage: 0,
  deathsDoorUsed: false,
  deathsDoorActive: false,
  deathsDoorTriggeredTurn: null,
  deathsDoorGraceTurnsRemaining: null,
  enemyHealth: 40,
  enemyMaxHealth: 40,
  lastEnemyAbilityId: null,
  enemyMitigation: {
    damageReduction: 0,
    damageReductionPercent: 0,
    blockReduction: 0,
    blockReductionPercent: 0,
    reflectDamage: 0,
    absorbShield: 0,
    flatArmorReduction: 0,
    damageReductionCapped: 0,
  },
  enemyRegeneration: 0,
  roomScalingMultiplier: 1,
  playerStatuses: {
    block: 0,
    armor: 0,
    thorns: 0,
    forge: 0,
    haste: 0,
    phoenixFeather: 0,
    burn: 0,
    poison: 0,
    bleed: 0,
    freeze: 0,
    stun: 0,
  },
  enemyStatuses: {
    burn: 0,
    poison: 0,
    bleed: 0,
    freeze: 0,
    stun: 0,
    burnBonus: 0,
    freezeBonus: 0,
    thorns: 0,
    onAttackBleed: 0,
  },
  flags: {},
  trinketEffects: {},
  gearEffects: { stats: {}, affixes: {} },
  talentEffects: { talents: {}, stats: {} },
  rng: () => 0.5,
};

const DEFAULT_REWARD_STATE = {
  selectedId: null,
  gold: 0,
  materials: { herbs: 0, stone: 0, iron: 0, gems: 0, food: 0, wood: 0 },
  destinations: [],
  selectedBossId: null,
  lastVictoryEnemyType: "normal",
  lastVictoryContentSystem: null,
  companionChoiceIds: [],
  rewardType: "card",
  choiceIds: [],
};

const DEFAULT_SHOP_STATE = { cards: [], refreshesLeft: 1, purchasedSlotKeys: [] };
const DEFAULT_ALCHEMIST_STATE = { potions: [], refreshesLeft: 1, purchasedSlotKeys: [] };
const DEFAULT_TRINKET_SHOP_STATE = { trinketIds: [], refreshesLeft: 1, purchasedSlotKeys: [] };
const DEFAULT_EQUIPMENT_SHOP_STATE = { gear: [], refreshesLeft: 1, purchasedSlotKeys: [] };
const DEFAULT_ALCHEMY_VISIT = { offers: [], completed: false, result: null, original: null };

/** Current-format activity fixtures use production defaults without a legacy decoder. */
export function savedActivityFixture(kind: PersistedRunActivity["kind"], data?: unknown): PersistedRunActivity {
  const defaults: Partial<Record<PersistedRunActivity["kind"], unknown>> = {
    battle: { battleState: DEFAULT_BATTLE_STATE },
    rewards: DEFAULT_REWARD_STATE,
    destination: { destinations: [], selectedBossId: null, lastVictoryEnemyType: null, lastVictoryContentSystem: null },
    shop: DEFAULT_SHOP_STATE,
    alchemist: DEFAULT_ALCHEMIST_STATE,
    "trinket-shop": DEFAULT_TRINKET_SHOP_STATE,
    "equipment-shop": DEFAULT_EQUIPMENT_SHOP_STATE,
    campfire: DEFAULT_ALCHEMY_VISIT,
    transmutation: DEFAULT_ALCHEMY_VISIT,
    corruption: null,
    mystery: {
      event: DEFAULT_MYSTERY_EVENT,
      chosenChoice: null,
      cardChoices: null,
      grantedTrinketIds: [],
      grantedGear: [],
      chosenCardId: null,
    },
  };
  return (
    Object.hasOwn(defaults, kind)
      ? {
          kind,
          data:
            data === undefined
              ? defaults[kind]
              : kind === "destination" && data && typeof data === "object"
                ? Object.fromEntries(Object.entries(data).filter(([key]) => key !== "kind"))
                : data,
        }
      : { kind }
  ) as PersistedRunActivity;
}

export function savedActivityData<T extends { activity: { kind: string } }, K extends T["activity"]["kind"]>(
  run: T | null | undefined,
  kind: K,
): (Extract<T["activity"], { kind: K }> extends { data: infer D } ? D : never) | null {
  const activity = run?.activity;
  return (activity?.kind === kind && "data" in activity ? activity.data : null) as
    | (Extract<T["activity"], { kind: K }> extends { data: infer D } ? D : never)
    | null;
}
