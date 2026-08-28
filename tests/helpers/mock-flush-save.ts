import { vi } from "vitest";

vi.mock("@/features/alchemy/shared/storage/flush-save", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    flushAlchemySaveNow: vi.fn().mockResolvedValue(undefined),
  };
});
