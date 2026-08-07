import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("run-state read model", () => {
  it("does not export deleted screen-twin session slices from capability ports", () => {
    const facade = read("src/features/alchemy/shared/stores/run-session-react-ports.ts");
    const model = read("src/features/alchemy/shared/stores/run-session-model.ts");
    for (const name of ["useRunSessionShopSlice", "useRunSessionMysterySlice", "useRunSessionLabyrinthSlice"]) {
      expect(facade).not.toContain(name);
      expect(model).not.toContain(`export function ${name}`);
    }
  });

  it("keeps exact screen-specific hooks as the screen-scoped React read surface", () => {
    const facade = read("src/features/alchemy/shared/stores/use-run-screen-data.ts");
    expect(facade).toContain("useRewardsScreenData");
    expect(facade).toContain("useShopScreenData");
    expect(facade).not.toContain("useRunScreenData");
    const routes = read("src/app/screen-routes/run-loop-routes.tsx");
    expect(routes).toContain("useRewardsScreenData");
    expect(routes).toContain("useShopScreenData");
    expect(routes).toContain("useBattleScreenRouteData");
    expect(routes).not.toContain("useRunScreenData");
  });

  it("routes cross-store React reads through the authoritative aggregate", () => {
    const facade = read("src/features/alchemy/shared/stores/run-session-react-ports.ts");
    const model = read("src/features/alchemy/shared/stores/run-session-model.ts");
    const screenHooks = read("src/features/alchemy/shared/stores/use-run-screen-data.ts");

    for (const source of [facade, model, screenHooks]) {
      expect(source).toContain("useGameplayStateStore");
      expect(source).not.toContain("useRunSessionCommitStore");
      expect(source).not.toContain("useRunDomainStore(");
      expect(source).not.toContain("useRunTransientStore(");
      expect(source).not.toContain("useRunBattleDomainStore(");
      expect(source).not.toContain("useRunProfileStore(");
    }
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
    expect(actions).toContain("readActiveRun");
    expect(actions).toContain("readRunSession");

    const shopController = read("src/features/alchemy/shell/use-shop-controller.ts");
    expect(shopController).not.toContain("run: RunStateController");
    expect(shopController).not.toMatch(/\brun,\s*talents/);
  });

  it("keeps imperative read ports separate from the domain store", () => {
    const readPort = read("src/features/alchemy/shared/stores/run-session-read-port.ts");
    expect(readPort).toContain("readActiveRun");
    expect(readPort).toContain("readRunProfile");
    expect(readPort).not.toContain("setRunGold");
    expect(readPort).not.toContain("run-session-queries");
  });

  it("keeps exact screen contracts without a broad field bag or unchecked cast", () => {
    const screenData = read("src/features/alchemy/shared/stores/run-screen-data.ts");
    const hooks = read("src/features/alchemy/shared/stores/use-run-screen-data.ts");
    expect(screenData).toContain("RunScreenDataByScreen");
    expect(screenData).not.toContain("interface RunScreenData {");
    expect(hooks).not.toContain("SCREEN_FIELDS");
    expect(hooks).not.toContain("as RunScreenData");
  });

  it("assembles routeCommands via createAlchemyRouteCommands, not an inline mega-tree", () => {
    const controller = read("src/features/alchemy/shell/use-alchemy-run-controller.ts");
    expect(controller).toContain("createAlchemyRouteCommands");
    expect(controller).not.toMatch(/routeCommands\s*=\s*\{/);
    const factory = read("src/features/alchemy/shell/create-route-commands.ts");
    expect(factory).toContain("export function createAlchemyRouteCommands");
    expect(factory).toContain("function createRunLoopRouteCommands");
  });

  it("splits run navigation into concern hooks and inlines thin factories", () => {
    const nav = read("src/features/alchemy/shell/use-run-flow-engine.ts");
    expect(nav).toContain("useRunDestinationWiring");
    expect(nav).toContain("useContentSystemNavigation");
    expect(nav).toContain("useMysteryEventNavigation");
    expect(nav).toContain("createRunFlowHandlers(");
    expect(nav).toContain("createCorruptionFlowHandlers(");
    expect(nav).toContain("createRunTeardown(");
    expect(nav).not.toContain("useRunFlowHandlers");
    expect(nav).not.toContain("useRunCorruptionFlow");
    expect(nav).not.toContain("useRunTeardown");
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

  it("run-flow handlers take RunFlowRunPort / RunFlowTalentPort and shell actions", () => {
    const deps = read("src/features/alchemy/run-loop/run/run-flow-handler-deps.ts");
    expect(deps).toContain("RunFlowRunPort");
    expect(deps).toContain("RunFlowTalentPort");
    expect(deps).toContain("actions: RunFlowShellActions");
    expect(deps).not.toContain("RunStateController");
    expect(deps).not.toContain("TalentStateController");
    expect(deps).not.toContain("onInitShop");
    expect(deps).not.toContain("onStartBattle");
    expect(deps).not.toContain("RunFlowDispatch");
    expect(deps).not.toContain("RunFlowIntent");

    const sharedPorts = read("src/features/alchemy/shared/stores/run-port-types.ts");
    expect(sharedPorts).toContain("export type RunFlowRunPort");
    expect(sharedPorts).toContain("export interface RunFlowTalentPort");
    expect(sharedPorts).toContain("export interface ActiveRunCorePort");
    expect(sharedPorts).toContain("export interface BattleRunPort");
    expect(sharedPorts).toContain("export interface RunOrchestrationPort");

    const actions = read("src/features/alchemy/run-loop/run/run-flow-shell-actions.ts");
    expect(actions).toContain("export interface RunFlowShellActions");
  });

  it("shell assembles RunFlowShellActions for run-flow handlers", () => {
    const nav = read("src/features/alchemy/shell/use-run-flow-engine.ts");
    expect(nav).toContain("RunFlowShellActions");
    expect(nav).toContain("actions");
    expect(nav).toContain("createRunFlowHandlers(");
    expect(nav).not.toContain("createRunFlowIntentExecutor");
    expect(nav).not.toContain("RunFlowDispatch");
    expect(nav).not.toContain("wildwoodNavOps");
    expect(nav).not.toContain("mysteryNavOps");

    const shellTypes = read("src/features/alchemy/shell/shell-types.ts");
    expect(shellTypes).toContain("interface BattleLauncherDeps");
    expect(shellTypes).toContain("export interface RunNavigationDeps");
    expect(shellTypes).not.toContain("ShopNavOps");
    expect(shellTypes).not.toContain("LabyrinthNavOps");
    expect(shellTypes).not.toContain("WildwoodNavOps");
    expect(shellTypes).not.toContain("MysteryNavOps");

    const destination = read("src/features/alchemy/run-loop/run/run-destination-handlers.ts");
    expect(destination).toContain("export type DestinationRouteDeps");
    expect(destination).not.toContain("DestinationRouteHandlers");

    const rewardTypes = read("src/features/alchemy/run-loop/navigation/reward-flow-types.ts");
    expect(rewardTypes).toContain("export interface RewardRouteDeps");
    expect(rewardTypes).not.toContain("RewardRouteTransitionHandlers");
    expect(rewardTypes).toContain("labyrinthClearNode");
    expect(rewardTypes).not.toContain("onLabyrinthClearNode");
  });

  it("the committed run session model shares the canonical active-run view picker", () => {
    const init = read("src/features/alchemy/shared/stores/run-state-init.ts");
    expect(init).toContain("export function pickActiveRunView");
    // The view is derived from the canonical model, not a second hand-maintained key list.
    expect(init).toMatch(/ActiveRunReadView = ActiveRunProgressFields/);
    expect(init).not.toContain("const ACTIVE_RUN_SESSION_CORE_KEYS");

    const readPort = read("src/features/alchemy/shared/stores/run-session-read-port.ts");
    expect(readPort).toContain("pickActiveRunView");

    const model = read("src/features/alchemy/shared/stores/run-session-model.ts");
    expect(model).toContain("pickActiveRunView");
    expect(model).not.toContain("ActiveRunSessionCoreFields");
  });

  it("exposes narrow orchestration ports instead of broad React adapters", () => {
    const facade = read("src/features/alchemy/shared/stores/run-session-react-ports.ts");
    for (const hook of ["useRunOrchestrationPort", "useBattleRunPort", "useBattleTalentPort", "useHomesteadEffects"]) {
      expect(facade).toContain(`export function ${hook}`);
    }
    expect(facade).not.toContain("useRunFlowRunPort");
    expect(facade).not.toContain("useWildwoodRunPort");
    expect(facade).not.toContain("useTalentCommandPort");
    expect(facade).not.toContain("useCorruptionRunPort");
    expect(facade).not.toContain("useRunAdapter");
    expect(facade).not.toContain("useTalentAdapter");
    expect(facade).not.toContain("useHomesteadAdapter");
  });
});
