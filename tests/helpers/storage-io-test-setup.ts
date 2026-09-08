import { beforeEach } from "vitest";
import { resetStorageIoForTests } from "@/features/alchemy/shared/storage";

export function installStorageIoTestHooks(): void {
  beforeEach(async () => {
    await resetStorageIoForTests();
  });
}
