import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import {
  createSessionPersistence,
  saveAlchemySaveData,
  type UnstampedSaveData,
} from "@/features/alchemy/shared/storage";

import type { GearDraftView } from "@/features/alchemy/shared/stores/gear-store-types";
import { describe, expectTypeOf, it } from "vitest";
import type { BattleCard } from "@/lib/game-data";
import type { useBattleController } from "@/features/alchemy/shell/use-battle-controller";
import type { AlchemyRunCommands } from "@/features/alchemy/shell/route-commands";
import type { RunFlowHandlerDeps } from "@/features/alchemy/run-loop/run/run-flow";
import type { RunScreenDataByScreen } from "@/features/alchemy/shared/stores/run-screen-data";
import {
  acceptCommand,
  rejectCommand,
  type CommandOutcome,
  dispatchRunSessionCommand,
  createRunSessionCommand,
  type RunTransaction,
} from "@/features/alchemy/shared/stores/run-session-command";
import {
  dispatchGearMutationWithRunHealthSync,
  mutateGearWithRunHealthSync,
} from "@/features/alchemy/shared/stores/gear-session-command";
import { commitEndTurn, createBattleCapabilities } from "@/features/alchemy/shared/stores/battle-commands";
import { defaultGameSession } from "@/app/application-session";

declare const asyncMutation: () => Promise<void>;
declare const maybeAsyncMutation: () => number | PromiseLike<number>;
declare const draft: RunTransaction;

type WritePort = typeof import("@/features/alchemy/shared/stores/run-session-write-port");
// Pure (non-mutating) helpers are exempt from the transaction-first rule.
type PureWriteHelper = "cloneRunObtainedItem";
type NonDraftFirstWrite = Exclude<
  {
    [Key in keyof WritePort]: WritePort[Key] extends (...args: infer Args) => unknown
      ? Args extends [RunTransaction, ...unknown[]]
        ? never
        : Key
      : never;
  }[keyof WritePort],
  PureWriteHelper
>;

describe("run architecture type contracts", () => {
  it("requires a career for reusable reads, writes, and persistence while bound methods need none", () => {
    // @ts-expect-error -- missing ownership must never select the application career
    readBattle();
    // @ts-expect-error -- combat writes require an owner
    commitEndTurn();
    // @ts-expect-error -- transactions require an owner even when no options are supplied
    dispatchRunSessionCommand(() => acceptCommand());
    // @ts-expect-error -- save IO cannot choose a career implicitly
    saveAlchemySaveData({} as UnstampedSaveData);
    expectTypeOf(createBattleCapabilities(defaultGameSession).endTurn).parameters.toEqualTypeOf<[]>();
    expectTypeOf(createSessionPersistence(defaultGameSession).snapshot).parameters.toEqualTypeOf<[]>();
  });
  it("requires combat data with battle activity and removes independently writable battle flags", () => {
    // @ts-expect-error -- a battle activity must carry its committed combat
    const incomplete: RunTransaction["session"]["activity"] = { kind: "battle" };
    void incomplete;
    expectTypeOf<Extract<keyof RunTransaction, "battle">>().toEqualTypeOf<never>();
    expectTypeOf<Extract<keyof WritePort, "setHasActiveBattle" | "initializeActiveBattle">>().toEqualTypeOf<never>();
  });
  it("keeps raw battle replacement and RNG binding out of the feature write port", () => {
    expectTypeOf<
      Extract<
        keyof WritePort,
        | "setBattleState"
        | "setSyncedBattleState"
        | "commitBattleTransition"
        | "withDraftWorldBattleRng"
        | "initializeActiveBattle"
      >
    >().toEqualTypeOf<never>();
  });

  it("keeps progress activity changes separate from display and visit entry", () => {
    type Kind = Parameters<WritePort["setRunProgressActivity"]>[1];
    expectTypeOf<
      Extract<Kind, "menu" | "options" | "shop" | "mystery" | "inactive" | "battle">
    >().toEqualTypeOf<never>();
    expectTypeOf<Extract<Kind, "draft-deck" | "difficulty-select">>().toEqualTypeOf<
      "draft-deck" | "difficulty-select"
    >();
  });

  it("rejects writes through transaction and Gear reads", () => {
    dispatchRunSessionCommand(
      (transaction) => {
        // @ts-expect-error -- only the Gold owner can change the purse
        transaction.runProfile.gold = 100;
        if (transaction.session.activity.kind === "battle") {
          // @ts-expect-error -- combat results commit through battle commands
          transaction.session.activity.data.battleState.enemyHealth = 0;
        }
        // @ts-expect-error -- arrays are deeply readonly
        transaction.run.activeRun.runDeck.push({} as BattleCard);
        // @ts-expect-error -- nested Gear data cannot bypass combat locks
        transaction.gear.loadouts.knight.body = null;
        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );
    dispatchGearMutationWithRunHealthSync(
      {
        mutate: (gear: GearDraftView) => {
          // @ts-expect-error -- exposed inventory is a read capability
          gear.inventories.knight.push({});
          // @ts-expect-error -- nested instance data is readonly too
          gear.inventories.knight[0]!.affixes[0]!.value = 99;
          // @ts-expect-error -- loadout edits must use equip/unequip
          gear.loadouts.knight.body = null;
        },
      },
      defaultGameSession,
    );
  });

  it("rejects asynchronous results at every generic command entry point", () => {
    // @ts-expect-error -- command acceptance must be explicit
    dispatchRunSessionCommand(() => false, undefined, defaultGameSession);
    // @ts-expect-error -- factories require explicit command outcomes
    createRunSessionCommand(() => null, undefined, defaultGameSession);
    // @ts-expect-error -- accepted payloads cannot contain Promises
    acceptCommand(asyncMutation());
    // @ts-expect-error -- rejected payloads cannot contain Promises
    rejectCommand("Async payload", maybeAsyncMutation());
    // @ts-expect-error -- commands cannot return Promises
    dispatchRunSessionCommand(asyncMutation, undefined, defaultGameSession);
    // @ts-expect-error -- a union containing a thenable is still asynchronous
    dispatchRunSessionCommand(maybeAsyncMutation, undefined, defaultGameSession);
    // @ts-expect-error -- factories cannot wrap asynchronous mutations
    createRunSessionCommand(asyncMutation, undefined, defaultGameSession);
    // @ts-expect-error -- factories reject mixed synchronous/asynchronous results
    createRunSessionCommand(maybeAsyncMutation, undefined, defaultGameSession);
    // @ts-expect-error -- gear commands cannot return Promises
    dispatchGearMutationWithRunHealthSync({ mutate: asyncMutation }, defaultGameSession);
    // @ts-expect-error -- gear commands reject mixed synchronous/asynchronous results
    dispatchGearMutationWithRunHealthSync({ mutate: maybeAsyncMutation }, defaultGameSession);
    // @ts-expect-error -- draft gear mutations cannot return Promises
    mutateGearWithRunHealthSync(draft, { mutate: asyncMutation });
    // @ts-expect-error -- draft gear mutations reject mixed synchronous/asynchronous results
    mutateGearWithRunHealthSync(draft, { mutate: maybeAsyncMutation });
  });

  it("preserves synchronous command results and factory arguments", () => {
    expectTypeOf(dispatchRunSessionCommand(() => acceptCommand(), undefined, defaultGameSession)).toEqualTypeOf<void>();
    expectTypeOf(
      dispatchRunSessionCommand(() => acceptCommand<number>(7), undefined, defaultGameSession),
    ).toEqualTypeOf<number>();
    expectTypeOf(
      dispatchRunSessionCommand(
        (): CommandOutcome<number | null> => rejectCommand("Unavailable", null),
        undefined,
        defaultGameSession,
      ),
    ).toEqualTypeOf<number | null>();
    expectTypeOf(
      dispatchRunSessionCommand(() => acceptCommand({ gold: 7 }), undefined, defaultGameSession),
    ).toEqualTypeOf<{ gold: number }>();
    dispatchRunSessionCommand(
      () => acceptCommand({ gold: 7 }),
      {
        afterCommit: (result) => {
          expectTypeOf(result).toEqualTypeOf<{ gold: number }>();
        },
      },
      defaultGameSession,
    );
    const command = createRunSessionCommand(
      (_draft, gold: number, label: string) => acceptCommand({ gold, label }),
      undefined,
      defaultGameSession,
    );
    expectTypeOf(command).toEqualTypeOf<(gold: number, label: string) => { gold: number; label: string }>();
    expectTypeOf(
      dispatchGearMutationWithRunHealthSync({ mutate: () => true }, defaultGameSession),
    ).toEqualTypeOf<boolean>();
    expectTypeOf(mutateGearWithRunHealthSync(draft, { mutate: (): number | null => null })).toEqualTypeOf<
      number | null
    >();
  });

  it("keeps every gameplay write-port mutation transaction-first", () => {
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
