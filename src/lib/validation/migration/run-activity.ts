import { emptyAlchemyVisit } from "@/lib/active-run-session/alchemy-visits";
import {
  emptyShopState,
  emptyAlchemistState,
  emptyEquipmentShopState,
  emptyTrinketShopState,
} from "@/lib/active-run-session/shop-session-types";
import { DRAFT_ROUNDS } from "@/lib/game-constants";
import { emptyInventory } from "@/lib/homestead/inventory";
import { isRunResumeScreen, type Screen } from "@/lib/routing";

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
const VISITS = {
  shop: "shopState",
  alchemist: "alchemistState",
  "trinket-shop": "trinketShopState",
  "equipment-shop": "equipmentShopState",
  mystery: "mysteryVisit",
  corruption: "corruptionResult",
  campfire: "campfireState",
  transmutation: "transmutationState",
} as const;
function emptyVisit(kind: keyof typeof VISITS): unknown {
  switch (kind) {
    case "shop":
      return emptyShopState();
    case "alchemist":
      return emptyAlchemistState();
    case "equipment-shop":
      return emptyEquipmentShopState();
    case "trinket-shop": {
      const { trinkets: _trinkets, ...visit } = emptyTrinketShopState();
      return { ...visit, trinketIds: [] };
    }
    case "campfire":
    case "transmutation":
      return emptyAlchemyVisit();
    case "mystery":
    case "corruption":
      return null;
  }
}
function emptyReward(source: Record<string, unknown> = {}) {
  return {
    rewardType: "card",
    choiceIds: [],
    companionChoiceIds: [],
    selectedId: null,
    gold: 0,
    materials: emptyInventory(),
    destinations: source.destinations ?? [],
    selectedBossId: source.selectedBossId ?? null,
    lastVictoryEnemyType: source.lastVictoryEnemyType ?? null,
    lastVictoryContentSystem: source.lastVictoryContentSystem ?? null,
  };
}
function exploration(run: Record<string, unknown>): string {
  if (run.labyrinthMap) return "labyrinth-map";
  const phase = record(run.wildwoodDraft).phase;
  return phase === "draft"
    ? "draft-deck"
    : phase === "removal"
      ? "wildwood-removal"
      : phase === "battle"
        ? "battle"
        : phase === "reward"
          ? "rewards"
          : "destination";
}
function legacyScreen(run: Record<string, unknown>): string {
  if (run.activeCombat) return "battle";
  const deckLength = Array.isArray(run.runDeck) ? run.runDeck.length : 0;
  if (run.characterId === "wildcard" && run.contentSystemType !== "wildwood") {
    if (Array.isArray(run.starterDraftChoices) && (run.starterDraftChoices.length > 0 || deckLength >= DRAFT_ROUNDS))
      return "draft-deck";
    if (run.contentSystemType === "campaign" && run.selectedDifficulty == null && deckLength >= DRAFT_ROUNDS)
      return "difficulty-select";
  }
  if (
    typeof run.currentScreen === "string" &&
    run.currentScreen !== "battle" &&
    isRunResumeScreen(run.currentScreen as Screen)
  )
    return run.currentScreen;
  const flow = record(run.interruptedFlow);
  if (flow.kind === "primary-reward" || flow.kind === "companion-reward") return "rewards";
  if (flow.kind === "destination") return "destination";
  for (const kind of ["mystery", "corruption", "shop", "alchemist", "trinket-shop", "equipment-shop"] as const)
    if (run[VISITS[kind]]) return kind;
  return exploration(run);
}

/** Data conversion only. No gameplay resolver, RNG or settlement may run here. */
export function migrateVersion20(save: Record<string, unknown>): Record<string, unknown> {
  if (!save.activeRun || typeof save.activeRun !== "object") return { ...save, saveSchemaVersion: 21 };
  const run = record(save.activeRun);
  let screen = legacyScreen(run);
  const flow = record(run.interruptedFlow);
  let pending = record(flow.pending);
  if (flow.kind === "companion-reward" && screen !== "battle") {
    pending = { ...emptyReward(pending), choiceIds: pending.companionChoiceIds ?? [] };
    screen = "rewards";
  } else if (flow.kind === "primary-reward" && screen !== "battle") {
    const hasValue =
      Number(pending.gold) > 0 ||
      Object.values(record(pending.materials)).some((amount) => Number(amount) > 0) ||
      (Array.isArray(pending.choiceIds) && pending.choiceIds.length > 0) ||
      (Array.isArray(pending.gearChoices) && pending.gearChoices.length > 0) ||
      (Array.isArray(pending.companionChoiceIds) && pending.companionChoiceIds.length > 0);
    const hasVisit = Object.values(VISITS).some(
      (key) =>
        run[key] &&
        ((key !== "campfireState" && key !== "transmutationState") ||
          record(run[key]).completed === true ||
          (Array.isArray(record(run[key]).offers) && (record(run[key]).offers as unknown[]).length > 0)),
    );
    if (screen === "rewards" || (!hasVisit && !(screen === "corruption" && !hasValue))) screen = "rewards";
  }
  let activity: Record<string, unknown>;
  // Older Wildwood preparation committed the boss before its snapshot. The
  // load instruction abandons that run; this data-only placeholder lets its
  // earned progress validate without manufacturing or executing a battle.
  if (screen === "battle")
    activity = run.activeCombat
      ? { kind: screen, data: { battleState: record(run.activeCombat).battleState } }
      : { kind: "draft-deck" };
  else if (screen === "rewards") activity = { kind: screen, data: { ...emptyReward(pending), ...pending } };
  else if (screen === "destination")
    activity = { kind: screen, data: emptyReward(flow.kind === "destination" ? flow : pending) };
  else if (Object.hasOwn(VISITS, screen))
    activity = {
      kind: screen,
      data: run[VISITS[screen as keyof typeof VISITS]] ?? emptyVisit(screen as keyof typeof VISITS),
    };
  else activity = { kind: screen };
  const combat = record(run.activeCombat);
  const modifiers = (key: string) =>
    Array.isArray(run[key]) && (run[key] as unknown[]).length > 0 ? run[key] : combat[key];
  const updated = {
    ...run,
    activity,
    activeLabyrinthModifiers: modifiers("activeLabyrinthModifiers"),
    activeLabyrinthRewardModifiers: modifiers("activeLabyrinthRewardModifiers"),
  };
  const retired = new Set(["activeCombat", "currentScreen", "interruptedFlow", ...Object.values(VISITS)]);
  const projected = Object.fromEntries(Object.entries(updated).filter(([key]) => !retired.has(key)));
  return { ...save, saveSchemaVersion: 21, activeRun: projected };
}

/** A load-only instruction for the winner; terminal committed battles still settle normally. */
export function legacyRunNeedsAbandonment(save: unknown): boolean {
  const root = record(save);
  if (Number(root.saveSchemaVersion) >= 21) return false;
  const run = record(root.activeRun);
  if (run.contentSystemType === "wildwood" && record(run.wildwoodDraft).phase === "battle" && !run.activeCombat)
    return true;
  const combat = record(run.activeCombat);
  const state = record(combat.battleState);
  if (!(Number(state.playerHealth) > 0 && Number(state.enemyHealth) > 0)) return false;
  return combat.pendingBattleTransition != null || state.turnPhase === "enemy";
}
