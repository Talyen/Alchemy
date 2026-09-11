import { SaveDataSchema, type ParsedSaveData } from "@/lib/validation";

// Throwing test helper (fails loudly). Production load uses
// safeParseWithErrors via evaluateSaveCandidates to accumulate per-card
// repair warnings without failing — see MIGRATIONS.md.
export function normalizeSaveData(parsed: unknown): ParsedSaveData {
  return SaveDataSchema.parse(parsed);
}
