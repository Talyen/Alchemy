import { describe, expectTypeOf, it } from "vitest";
import type { BattleCard } from "@/lib/game-data";
import type { useBattleController } from "@/features/alchemy/shell/use-battle-controller";
import type { AlchemyRunCommands } from "@/features/alchemy/shell/use-alchemy-run-controller";
import type { RunFlowHandlerDeps } from "@/features/alchemy/run-loop/run/run-flow-handler-deps";
import type { RunScreenDataByScreen } from "@/features/alchemy/shared/stores/run-screen-data";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";

type WritePort = typeof import("@/features/alchemy/shared/stores/run-session-write-port");
type PureBattleRngHelper = "withRestingWorldBattleRng" | "withRestingEndPlayerTurnResolution";
type NonDraftFirstWrite = Exclude<
  {
    [Key in keyof WritePort]: WritePort[Key] extends (...args: infer Args) => unknown
      ? Args extends [GameplayDraft, ...unknown[]]
        ? never
        : Key
      : never;
  }[keyof WritePort],
  PureBattleRngHelper
>;

describe("run architecture type contracts", () => {
  it("keeps every gameplay write-port mutation draft-first", () => {
    expectTypeOf<NonDraftFirstWrite>().toEqualTypeOf<never>();
  });

  it("keeps battle commands draft-sourced and run-flow controllers capability-specific", () => {
    type BattleProps = Parameters<typeof useBattleController>[0];

    expectTypeOf<Extract<keyof BattleProps, "run" | "talents" | "homesteadEffects">>().toEqualTypeOf<never>();
    expectTypeOf<keyof RunFlowHandlerDeps>().toEqualTypeOf<"actions" | "getAvailableDestinations">();
  });

  it("keeps display data out of the shell command controller", () => {
    type RouteCommands = AlchemyRunCommands["routeCommands"];
    type ForbiddenDisplayKeys = Extract<
      keyof AlchemyRunCommands,
      | "battleState"
      | "characterId"
      | "contentSystemType"
      | "hasActiveBattle"
      | "rewardState"
      | "runPhase"
      | "shopState"
      | "talentXP"
      | "unlockedTalents"
    >;

    expectTypeOf<ForbiddenDisplayKeys>().toEqualTypeOf<never>();
    expectTypeOf<AlchemyRunCommands>().toHaveProperty("routeCommands");
    expectTypeOf<AlchemyRunCommands>().toHaveProperty("screen");
    expectTypeOf<keyof RouteCommands>().toEqualTypeOf<"meta" | "runSetup" | "runLoop" | "battle" | "runEnd">();
  });

  it("keeps route commands isolated by phase", () => {
    type RouteCommands = AlchemyRunCommands["routeCommands"];
    type RunLoopCrossPhaseKeys = Extract<
      keyof RouteCommands["runLoop"],
      "handleCardClick" | "handleCharacterSelect" | "goToScreen"
    >;
    type MetaCrossPhaseKeys = Extract<
      keyof RouteCommands["meta"],
      "handleCardClick" | "handleCharacterSelect" | "continueFromRunEnd"
    >;

    expectTypeOf<RunLoopCrossPhaseKeys>().toEqualTypeOf<never>();
    expectTypeOf<MetaCrossPhaseKeys>().toEqualTypeOf<never>();
  });

  it("keeps screen data contracts exact and screen-specific", () => {
    expectTypeOf<keyof RunScreenDataByScreen["shop"]>().toEqualTypeOf<"gold" | "runDeck" | "shopState">();
    expectTypeOf<keyof RunScreenDataByScreen["rewards"]>().toEqualTypeOf<"rewardState" | "rewardClaimInFlight">();
    expectTypeOf<RunScreenDataByScreen["shop"]["runDeck"]>().toEqualTypeOf<BattleCard[]>();
  });
});
