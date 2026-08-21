// Shared @/lib/audio test mock. Import for its side effect in a test file that
// needs audio silenced and call-recorded:
//
//   import "../../helpers/mock-audio";
//   import { playDefeat } from "@/lib/audio";   // resolves to the mock
//
// Every facade export becomes a vi.fn(); access/argue on it via
// `vi.mocked(playDefeat)`. Vitest hoists vi.mock above static imports, so
// position relative to other imports does not matter.
import { vi } from "vitest";

vi.mock("@/lib/audio", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const mocked = Object.fromEntries(Object.keys(actual).map((key) => [key, vi.fn()]));
  return { ...actual, ...mocked };
});
