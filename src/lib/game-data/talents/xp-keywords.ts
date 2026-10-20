import type { KeywordId } from "../types";
import { talentPoolByKeyword } from "./talent-pool-definitions";

/** Keywords that have a shipped talent tree and can therefore earn spendable XP. */
export const TALENT_TREE_KEYWORD_IDS: ReadonlySet<KeywordId> = new Set(talentPoolByKeyword.keys());
