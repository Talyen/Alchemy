export interface PlanMetadataResult {
  metadata: Record<string, string>;
  errors: string[];
  updated?: Date;
}

export function parsePlanMetadata(source: string): PlanMetadataResult;
