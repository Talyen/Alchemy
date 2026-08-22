// Shared @/features/alchemy/shared/storage/flush-save test mock. Import for its
// side effect in a test file that needs save flushing silenced and recorded:
//
//   import "../../helpers/mock-flush-save";
//   import { flushAlchemySaveNow } from "@/features/alchemy/shared/storage/flush-save";
//
// `flushAlchemySaveNow` becomes a plain vi.fn() (production consumers void-call
// it; set a resolved value per-test if you await it). Other module exports keep
// their real implementations. Argue on the mock via `vi.mocked(flushAlchemySaveNow)`.
// Vitest hoists vi.mock above static imports, so position relative to other
// imports does not matter.
import { vi } from "vitest";

vi.mock("@/features/alchemy/shared/storage/flush-save", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    flushAlchemySaveNow: vi.fn(),
  };
});
