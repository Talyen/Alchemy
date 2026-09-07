import { describe, expectTypeOf, it } from "vitest";
import type { BattleCard } from "@/lib/game-data";
import type { useBattleController } from "@/features/alchemy/shell/use-battle-controller";
import type { AlchemyRunCommands } from "@/features/alchemy/shell/use-alchemy-run-controller";
import type { RunFlowHandlerDeps } from "@/features/alchemy/run-loop/run/run-flow-handler-deps";
import type { RunScreenDataByScreen } from "@/features/alchemy/shared/stores/run-screen-data";
import {
  dispatchRunSessionCommand,
  createRunSessionCommand,
  type GameplayDraft,
} from "@/features/alchemy/shared/stores/run-session-command";
import {
  dispatchGearMutationWithRunHealthSync,
  mutateGearWithRunHealthSync,
} from "@/features/alchemy/shared/stores/gear-session-command";

declare const asyncMutation: () => Promise<void>;
declare const maybeAsyncMutation: () => number | PromiseLike<number>;
declare const draft: GameplayDraft;

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
  it("rejects asynchronous results at every generic command entry point", () => {
    // @ts-expect-error -- commands cannot return Promises
    dispatchRunSessionCommand(asyncMutation);
    // @ts-expect-error -- a union containing a thenable is still asynchronous
    dispatchRunSessionCommand(maybeAsyncMutation);
    // @ts-expect-error -- factories cannot wrap asynchronous mutations
    createRunSessionCommand(asyncMutation);
    // @ts-expect-error -- factories reject mixed synchronous/asynchronous results
    createRunSessionCommand(maybeAsyncMutation);
    // @ts-expect-error -- gear commands cannot return Promises
    dispatchGearMutationWithRunHealthSync({ mutate: asyncMutation });
    // @ts-expect-error -- gear commands reject mixed synchronous/asynchronous results
    dispatchGearMutationWithRunHealthSync({ mutate: maybeAsyncMutation });
    // @ts-expect-error -- draft gear mutations cannot return Promises
    mutateGearWithRunHealthSync(draft, { mutate: asyncMutation });
    // @ts-expect-error -- draft gear mutations reject mixed synchronous/asynchronous results
    mutateGearWithRunHealthSync(draft, { mutate: maybeAsyncMutation });
  });

  it("preserves synchronous command results and factory arguments", () => {
    expectTypeOf(dispatchRunSessionCommand((): void => undefined)).toEqualTypeOf<void>();
    expectTypeOf(dispatchRunSessionCommand(() => 7)).toEqualTypeOf<number>();
    expectTypeOf(dispatchRunSessionCommand((): number | null => null)).toEqualTypeOf<number | null>();
    expectTypeOf(dispatchRunSessionCommand(() => ({ gold: 7 }))).toEqualTypeOf<{ gold: number }>();
    dispatchRunSessionCommand(() => ({ gold: 7 }), {
      afterCommit: (result) => {
        expectTypeOf(result).toEqualTypeOf<{ gold: number }>();
      },
    });
    const command = createRunSessionCommand((_draft, gold: number, label: string) => ({ gold, label }));
    expectTypeOf(command).toEqualTypeOf<(gold: number, label: string) => { gold: number; label: string }>();
    expectTypeOf(dispatchGearMutationWithRunHealthSync({ mutate: () => true })).toEqualTypeOf<boolean>();
    expectTypeOf(mutateGearWithRunHealthSync(draft, { mutate: (): number | null => null })).toEqualTypeOf<
      number | null
    >();
  });

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
