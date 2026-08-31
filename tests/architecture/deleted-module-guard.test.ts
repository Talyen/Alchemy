import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

describe("deleted module guard", () => {
  it("removed run glue modules are not present", () => {
    const deleted = [
      "src/features/alchemy/shared/stores/run-lifecycle-coordinator.ts",
      "src/features/alchemy/shared/stores/run-store-sync.ts",
      "src/features/alchemy/shared/stores/store-access.ts",
      "src/features/alchemy/shared/stores/run-progress-store.ts",
      "src/features/alchemy/shared/stores/run-store-shim.ts",
      "src/features/alchemy/shared/stores/battle-store.ts",
      "src/features/alchemy/shared/stores/run-session-store.ts",
      "src/features/alchemy/shared/stores/run-session-read.ts",
      "src/features/alchemy/shared/stores/run-session-actions.ts",
      "src/features/alchemy/shared/stores/navigation-store.ts",
      "src/features/alchemy/shared/stores/run-profile-store.ts",
      "src/features/alchemy/shared/stores/run-transient-store.ts",
      "src/features/alchemy/shared/stores/run-battle-domain-store.ts",
      "src/features/alchemy/shared/stores/run-session-queries.ts",
      "src/lib/validation/migration.ts",
      "src/lib/validation/save-schemas.ts",
      "src/features/alchemy/run-loop/battle/presentation-types.ts",
      "src/features/alchemy/run-loop/corruption.ts",
      "src/features/alchemy/run-loop/navigation/use-mystery-flow.ts",
      "src/features/alchemy/run-loop/screens/battle-screen/card-transfer-overlay.tsx",
      "src/features/alchemy/shared/utils/card-description.ts",
      "src/features/alchemy/run-loop/battle/battle-playback-bind.ts",
      "src/features/alchemy/shared/stores/encode-corruption.ts",
      "src/features/alchemy/shared/stores/encode-mystery-visit.ts",
      "src/features/alchemy/run-loop/run-gold.ts",
      "src/features/alchemy/shared/ui/trinket-item-title.tsx",
      "src/lib/battle/leech-heal.ts",
      "src/lib/battle/start-health.ts",
      "src/lib/battle/enemy-trait-query.ts",
    ];
    for (const path of deleted) {
      expect(existsSync(join(ROOT, path)), path).toBe(false);
    }
  });
});
