import { describe, expectTypeOf, it } from "vitest";
import type { BattleCard } from "@/lib/game-data";
import type { useBattleController } from "@/features/alchemy/shell/use-battle-controller";
import type { AlchemyRunCommands } from "@/features/alchemy/shell/use-alchemy-run-controller";
import type { RunFlowHandlerDeps } from "@/features/alchemy/run-loop/run/run-flow-handler-deps";
import type {
  BattleRunPort,
  BattleTalentPort,
  RunFlowRunPort,
  RunFlowTalentPort,
  RunOrchestrationPort,
} from "@/features/alchemy/shared/stores/run-port-types";
import type { RunScreenDataByScreen } from "@/features/alchemy/shared/stores/run-screen-data";
import type { useRunOrchestrationPort } from "@/features/alchemy/shared/stores/run-session-react-ports";

describe("run architecture type contracts", () => {
  it("keeps battle and run-flow controllers on capability-specific ports", () => {
    type BattleProps = Parameters<typeof useBattleController>[0];

    expectTypeOf<BattleProps["run"]>().toEqualTypeOf<BattleRunPort>();
    expectTypeOf<BattleProps["talents"]>().toEqualTypeOf<BattleTalentPort>();
    expectTypeOf<RunFlowHandlerDeps["run"]>().toEqualTypeOf<RunFlowRunPort>();
    expectTypeOf<RunFlowHandlerDeps["talents"]>().toEqualTypeOf<RunFlowTalentPort>();
    expectTypeOf<ReturnType<typeof useRunOrchestrationPort>>().toEqualTypeOf<RunOrchestrationPort>();
  });

  it("keeps display data out of the shell command controller", () => {
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
  });

  it("keeps screen data contracts exact and screen-specific", () => {
    expectTypeOf<keyof RunScreenDataByScreen["shop"]>().toEqualTypeOf<"runGold" | "runDeck" | "shopState">();
    expectTypeOf<keyof RunScreenDataByScreen["rewards"]>().toEqualTypeOf<"rewardState" | "rewardClaimInFlight">();
    expectTypeOf<RunScreenDataByScreen["shop"]["runDeck"]>().toEqualTypeOf<BattleCard[]>();
  });
});
