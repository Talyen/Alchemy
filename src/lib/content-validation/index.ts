import { boardCatalog, isBoardId, STARTER_BOARD_ID } from "@/lib/boards/catalog";
import { boardArt } from "@/lib/game-data";
import type { ContentValidationIssue, ContentValidationResult } from "./types";
import { addDuplicateIssues, createCollector, type Collector } from "./utils";
import { validateTalents, validateKeywordsAndStatuses, validateEncounterTraits } from "./validators";
import { validateCards, validateTrinkets } from "./validators-cards";
import { validateEnemies, validateCompanions } from "./validators-enemies";
import { validateGear } from "./validators-gear";
import { validateTypography } from "./validators-typography";

export type { ContentValidationResult } from "./types";

const SEVERITY_RANK: Record<ContentValidationIssue["severity"], number> = {
  error: 0,
  warning: 1,
};

function sortIssues(issues: ContentValidationIssue[]): ContentValidationIssue[] {
  return [...issues].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      a.area.localeCompare(b.area) ||
      a.id.localeCompare(b.id) ||
      a.message.localeCompare(b.message),
  );
}

function validateBoards(collector: Collector): void {
  addDuplicateIssues(
    boardCatalog.map((board) => board.id),
    "art",
    "board ID",
    collector,
  );
  if (!isBoardId(STARTER_BOARD_ID))
    collector.error("art", STARTER_BOARD_ID, "Starter board is missing from the board catalog");
  for (const board of boardCatalog) {
    if (!board.title.trim()) collector.error("art", board.id, "Board title is empty");
    if (!boardArt[board.id]?.full || !boardArt[board.id]?.thumbnail)
      collector.error("art", board.id, "Board needs full art and a gallery thumbnail");
  }
}

export function runContentValidation(): ContentValidationResult {
  const collector = createCollector();
  validateCards(collector);
  validateEnemies(collector);
  validateCompanions(collector);
  validateTrinkets(collector);
  validateTalents(collector);
  validateKeywordsAndStatuses(collector);
  validateEncounterTraits(collector);
  validateGear(collector);
  validateTypography(collector);
  validateBoards(collector);

  const issues = sortIssues(collector.issues);
  return {
    issues,
    errors: issues.filter((issue) => issue.severity === "error"),
    warnings: issues.filter((issue) => issue.severity === "warning"),
  };
}
