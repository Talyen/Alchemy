import { beforeEach } from "vitest";
import { resetStorageIoForTests } from "@/features/alchemy/shared/storage/io";

export function installStorageIoTestHooks(): void {
  beforeEach(async () => {
    await resetStorageIoForTests();
  });
}
