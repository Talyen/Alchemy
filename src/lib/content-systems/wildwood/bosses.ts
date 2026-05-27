// Wildwood boss ID list — source of truth is enemyBestiary (compendium).
// Only the IDs live here; all display data (title, art, attacks, traits) is
// looked up from the compendium at render time.

export const WILDWOOD_BOSS_IDS = ["forge-golem", "frostwarden", "blight-treant", "iron-bear"] as const;
