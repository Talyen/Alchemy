import { beforeEach } from "vitest";
import { resetStorageIoForTests } from "@/features/alchemy/shared/storage/io";

/** Reset module-scoped IO write policy/backend between files that touch `io.ts`. */
export function installStorageIoTestHooks(): void {
  beforeEach(async () => {
    await resetStorageIoForTests();
  });
}
