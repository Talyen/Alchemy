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
    ];
    for (const path of deleted) {
      expect(existsSync(join(ROOT, path)), path).toBe(false);
    }
  });
});
