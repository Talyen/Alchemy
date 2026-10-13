import type { PersistedRunActivity } from "@/lib/active-run-session/types";

const DEFAULT_REWARD_STATE = {
  selectedId: null,
  gold: 0,
  materials: { herbs: 0, stone: 0, iron: 0, gems: 0, food: 0, wood: 0, hide: 0 },
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

// Shared with Node-side Playwright discovery: keep runtime game and artwork imports out.
// Battles and Mysteries supply their scenario-specific data explicitly.
export function savedActivityFixture(kind: PersistedRunActivity["kind"], data?: unknown): PersistedRunActivity {
  const defaults: Partial<Record<PersistedRunActivity["kind"], unknown>> = {
    rewards: DEFAULT_REWARD_STATE,
    destination: { destinations: [], selectedBossId: null, lastVictoryEnemyType: null, lastVictoryContentSystem: null },
    shop: DEFAULT_SHOP_STATE,
    alchemist: DEFAULT_ALCHEMIST_STATE,
    "trinket-shop": DEFAULT_TRINKET_SHOP_STATE,
    "equipment-shop": DEFAULT_EQUIPMENT_SHOP_STATE,
    campfire: DEFAULT_ALCHEMY_VISIT,
    transmutation: DEFAULT_ALCHEMY_VISIT,
    corruption: null,
  };
  if ((kind === "battle" || kind === "mystery") && data === undefined)
    throw new Error(`${kind} fixtures require explicit activity data`);
  return (
    data !== undefined || Object.hasOwn(defaults, kind)
      ? {
          kind,
          data:
            data === undefined
              ? structuredClone(defaults[kind])
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
