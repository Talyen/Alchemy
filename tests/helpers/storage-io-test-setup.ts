import { beforeEach } from "vitest";
import { resetStorageIoForTests } from "@/features/alchemy/shared/storage/io";
import { defaultGameSession } from "@/app/application-session";

export function installStorageIoTestHooks(): void {
  beforeEach(async () => {
    await resetStorageIoForTests(defaultGameSession);
  });
}
