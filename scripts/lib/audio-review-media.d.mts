import type { ReviewCandidate } from "./audio-review.mjs";

interface ReviewMedia {
  available: boolean;
  original?: string;
  matched?: string;
  error?: string;
}

export function currentSoundIdentity(
  root: string,
  files: string[],
): Promise<
  Record<
    string,
    {
      hashes: string[];
      rawSource: string | null;
      approvedExcerpt?: { assetId: string; start: number; duration: number };
    }
  >
>;

export function prepareReviewMedia(options: {
  root: string;
  libraryRoot: string;
  output: string;
  mappings: Array<{
    currentFiles: string[];
    candidates: Array<ReviewCandidate & { storedSha256?: string; mediaId?: string }>;
  }>;
  checkOnly?: boolean;
}): Promise<{ media: Record<string, ReviewMedia>; failures: Array<{ id: string; error: string }> }>;
