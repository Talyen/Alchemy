import { SaveDataSchema, type ParsedSaveData } from "@/lib/validation";

export function normalizeSaveData(parsed: unknown): ParsedSaveData {
  return SaveDataSchema.parse(parsed);
}
