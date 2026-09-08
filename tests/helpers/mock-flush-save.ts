import { vi } from "vitest";

vi.mock("@/features/alchemy/shared/storage", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    saveAlchemySaveData: vi.fn().mockResolvedValue("saved"),
    saveAlchemySaveDataForExit: vi.fn().mockResolvedValue("saved"),
  };
});
