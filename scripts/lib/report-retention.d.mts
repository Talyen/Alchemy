export interface RetentionCandidate {
  path: string;
  logicalBytes: number;
  allocatedFileBytes: number;
  metadataFingerprint: string;
  status: string;
  family: string;
  purpose: string;
  recovery: string;
  action: string;
}
export interface RetentionPlan {
  schema: number;
  kind: string;
  generatedAt: string;
  budget: number;
  allocatedFileBytes: number;
  protected: number;
  candidates: RetentionCandidate[];
  permanentDeletionApproved: boolean;
  note: string;
  incomplete?: string;
  moreCandidates?: boolean;
  overBudget?: boolean;
}
export interface RetentionOptions {
  now?: number;
  budget?: number;
  maxEntries?: number;
}
export function reportRetentionPlan(rootDir: string, options?: RetentionOptions): RetentionPlan;
export function writeRetentionReview(rootDir: string, options?: RetentionOptions): RetentionPlan;
