import { expectTypeOf, it } from "vitest";
import type { z } from "zod";
import type { PersistedRunProgress, PersistedPendingReward } from "@/lib/active-run-session";
import type { RunProgressSchema } from "@/lib/validation/save-schemas/run-progress";
import type { ParsedActiveRunData } from "@/lib/validation";

type ParsedProgress = z.output<typeof RunProgressSchema>;
type DomainProgress = Omit<PersistedRunProgress, "runDeck" | "completedDestinations" | "lastOfferedDestinations">;
type SchemaProgress = Omit<ParsedProgress, "runDeck" | "completedDestinations" | "lastOfferedDestinations">;

it("keeps all progress fields and reward variants aligned across the save boundary", () => {
  expectTypeOf<keyof ParsedProgress>().toEqualTypeOf<keyof PersistedRunProgress>();
  expectTypeOf<SchemaProgress>().toEqualTypeOf<DomainProgress>();
  expectTypeOf<
    Extract<ParsedActiveRunData["activity"], { kind: "rewards" }>["data"]
  >().toExtend<PersistedPendingReward>();
  expectTypeOf<PersistedPendingReward>().toExtend<
    Extract<ParsedActiveRunData["activity"], { kind: "rewards" }>["data"]
  >();
});
