// Save migration helpers — test-facing entry points for the production Zod validation pipeline.
// normalizeSaveData is a thin wrapper around SaveDataSchema so tests exercise the real production
// path (Zod preprocess + migration + field-level .catch) rather than a parallel implementation.
// Depends on: save-schemas.ts (SaveDataSchema), lib/validation (migration utils).
// Used by: tests/features/alchemy/shared/storage/migrations.test.ts only — NOT on the production load path.
import {
  SaveDataSchema,
  getRawSaveSchemaVersion,
  migrateSaveDataToCurrent,
  isUnsupportedFutureSaveData,
  type ParsedSaveData,
} from "@/lib/validation";

// Re-export the building blocks tests use to assert on intermediate migration steps.
export { getRawSaveSchemaVersion, migrateSaveDataToCurrent, isUnsupportedFutureSaveData };

// Delegates to SaveDataSchema — the production load path in io.ts.
// Any change to SaveDataSchema (field defaults, migration steps, clamping) is automatically
// exercised by migrations.test.ts without needing a second implementation.
// SaveDataSchema uses .catch() on every field, so this will not throw for arbitrary input.
export function normalizeSaveData(parsed: unknown): ParsedSaveData {
  return SaveDataSchema.parse(parsed);
}
