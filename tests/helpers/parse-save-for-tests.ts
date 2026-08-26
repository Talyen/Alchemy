// Test-facing wrapper around SaveDataSchema.parse so suites exercise the
// production Zod pipeline without a feature-layer helper.
import { SaveDataSchema, type ParsedSaveData } from "@/lib/validation";

export function normalizeSaveData(parsed: unknown): ParsedSaveData {
  return SaveDataSchema.parse(parsed);
}
