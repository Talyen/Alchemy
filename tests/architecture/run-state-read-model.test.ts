import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("run-state read model", () => {
  it("does not export deleted screen-twin session slices from the facade", () => {
    const facade = read("src/features/alchemy/shared/stores/run-session-facade.ts");
    const model = read("src/features/alchemy/shared/stores/run-session-model.ts");
    for (const name of ["useRunSessionShopSlice", "useRunSessionMysterySlice", "useRunSessionLabyrinthSlice"]) {
      expect(facade).not.toContain(name);
      expect(model).not.toContain(`export function ${name}`);
    }
  });

  it("keeps useRunScreenData as the screen-scoped React read surface", () => {
    const facade = read("src/features/alchemy/shared/stores/run-session-facade.ts");
    expect(facade).toContain("useRunScreenData");
    const routes = read("src/app/screen-routes/run-loop-routes.tsx");
    expect(routes).toContain("useRunScreenData");
  });

  it("does not re-export shop/rewards/mystery display state from the mega-controller", () => {
    const controller = read("src/features/alchemy/shell/use-alchemy-run-controller.ts");
    expect(controller).not.toMatch(/rewardState:\s*nav\.rewardState/);
    expect(controller).not.toContain("shop.shopCards");
    expect(controller).not.toContain("shop.alchemistPotions");
    expect(controller).not.toContain("nav.mysteryEvent");
  });

  it("does not re-export battle/character/talent display fields from the mega-controller", () => {
    const controller = read("src/features/alchemy/shell/use-alchemy-run-controller.ts");
    for (const forbidden of [
      "battleState: battle.battleState",
      "hasActiveBattle: battle.hasActiveBattle",
      "characterId: run.characterId",
      "contentSystemType: run.contentSystemType",
      "talentXP: talents.talentXP",
      "unlockedTalents: talents.unlockedTalents",
      "runPhase: nav.runPhase",
    ]) {
      expect(controller).not.toContain(forbidden);
    }
  });

  it("App chrome and autosave read via facade hooks, not controller display bags", () => {
    const app = read("src/App.tsx");
    expect(app).toContain("useActiveRunCharacterId");
    expect(app).toContain("useRunSessionBattleContext");
    expect(app).toContain("useRunSessionNavigationSlice");
    expect(app).not.toContain("run.battleState");
    expect(app).not.toContain("run.characterId");
    expect(app).not.toContain("run.runPhase");

    const chrome = read("src/app/app-screen-chrome-context.tsx");
    expect(chrome).toContain("useActiveRunCharacterId");
    expect(chrome).toContain("useTalentProgressSlice");
    expect(chrome).not.toContain("run.characterId");
    expect(chrome).not.toContain("run.talentXP");
  });

  it("shop actions read run fields imperatively, not via RunStateController", () => {
    const types = read("src/features/alchemy/run-loop/shop/shop-action-types.ts");
    expect(types).not.toContain("RunStateController");
    expect(types).toContain("talentEffects: TalentEffectManifest");

    const actions = read("src/features/alchemy/run-loop/shop/create-shop-actions.ts");
    expect(actions).toContain("readActiveRunStore");
    expect(actions).toContain("readRunSessionStore");

    const shopController = read("src/features/alchemy/shell/use-shop-controller.ts");
    expect(shopController).not.toContain("run: RunStateController");
    expect(shopController).not.toMatch(/\brun,\s*talents/);
  });

  it("keeps composed views and adapters in run-store-views, not the domain store", () => {
    const domain = read("src/features/alchemy/shared/stores/run-domain-store.ts");
    expect(domain).not.toContain("export function getRunProgressStoreView");
    expect(domain).not.toContain("export function useRunAdapter");
    expect(domain).not.toContain("export function selectRunController");

    const views = read("src/features/alchemy/shared/stores/run-store-views.ts");
    expect(views).toContain("export function getRunProgressStoreView");
    expect(views).toContain("export function useRunAdapter");
    expect(views).toContain("export function selectRunController");
  });

  it("does not keep a production flatten twin beside useRunScreenData", () => {
    const screenData = read("src/features/alchemy/shared/stores/run-screen-data.ts");
    expect(screenData).not.toContain("flattenRunSessionForScreens");
    expect(screenData).toContain("export interface RunScreenData");
  });

  it("assembles routeCommands via createAlchemyRouteCommands, not an inline mega-tree", () => {
    const controller = read("src/features/alchemy/shell/use-alchemy-run-controller.ts");
    expect(controller).toContain("createAlchemyRouteCommands");
    expect(controller).not.toMatch(/routeCommands\s*=\s*\{/);
    const factory = read("src/features/alchemy/shell/create-route-commands.ts");
    expect(factory).toContain("export function createAlchemyRouteCommands");
    expect(factory).toContain("function createRunLoopRouteCommands");
  });

  it("splits run navigation into concern hooks rather than inlining factories", () => {
    const nav = read("src/features/alchemy/shell/use-run-navigation.ts");
    expect(nav).toContain("useRunDestinationWiring");
    expect(nav).toContain("useContentSystemNavigation");
    expect(nav).toContain("useRunFlowHandlers");
    expect(nav).toContain("useRunCorruptionFlow");
    expect(nav).toContain("useRunTeardown");
    expect(nav).toContain("useMysteryEventNavigation");
    expect(nav).not.toContain("createRunFlowHandlers(");
    expect(nav).not.toContain("createCorruptionFlowHandlers(");
    expect(nav).not.toContain("createRunTeardown(");
    expect(nav).not.toContain("createContentSystemNavigation(");
  });

  it("battle controller takes BattleRunPort / BattleTalentPort, not RunStateController", () => {
    const battleController = read("src/features/alchemy/shell/use-battle-controller.ts");
    expect(battleController).toContain("BattleRunPort");
    expect(battleController).toContain("BattleTalentPort");
    expect(battleController).not.toContain("run: RunStateController");
    expect(battleController).not.toContain("talents: TalentStateController");

    const context = read("src/features/alchemy/run-loop/battle/battle-context.ts");
    expect(context).toContain("BattleRunPort");
    expect(context).toContain("BattleTalentPort");
    expect(context).not.toContain("RunStateController");
  });

  it("run-flow handlers take RunFlowRunPort / RunFlowTalentPort and dispatch intents", () => {
    const deps = read("src/features/alchemy/run-loop/run/run-flow-handler-deps.ts");
    expect(deps).toContain("RunFlowRunPort");
    expect(deps).toContain("RunFlowTalentPort");
    expect(deps).toContain("dispatch: RunFlowDispatch");
    expect(deps).not.toContain("RunStateController");
    expect(deps).not.toContain("TalentStateController");
    expect(deps).not.toContain("onInitShop");
    expect(deps).not.toContain("onStartBattle");
    expect(deps).not.toContain("navigateTo:");

    const ports = read("src/features/alchemy/run-loop/run/run-flow-ports.ts");
    expect(ports).toContain("export interface RunFlowRunPort");
    expect(ports).toContain("export interface RunFlowTalentPort");

    const intents = read("src/features/alchemy/run-loop/run/run-flow-intents.ts");
    expect(intents).toContain("export type RunFlowIntent");
  });

  it("shell executes run-flow intents via createRunFlowIntentExecutor", () => {
    const executor = read("src/features/alchemy/shell/create-run-flow-intent-executor.ts");
    expect(executor).toContain("export function createRunFlowIntentExecutor");

    const nav = read("src/features/alchemy/shell/use-run-navigation.ts");
    expect(nav).toContain("createRunFlowIntentExecutor");
    expect(nav).toContain("dispatch");
  });

  it("selectRunController and pickRunSessionRunSlice share pickActiveRunSessionCoreFields", () => {
    const init = read("src/features/alchemy/shared/stores/run-state-init.ts");
    expect(init).toContain("export function pickActiveRunSessionCoreFields");
    expect(init).toContain("const ACTIVE_RUN_SESSION_CORE_KEYS");

    const views = read("src/features/alchemy/shared/stores/run-store-views.ts");
    expect(views).toContain("pickActiveRunSessionCoreFields");

    const model = read("src/features/alchemy/shared/stores/run-session-model.ts");
    expect(model).toContain("pickActiveRunSessionCoreFields");
  });
});
