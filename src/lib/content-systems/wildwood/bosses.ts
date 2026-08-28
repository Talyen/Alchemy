export const WILDWOOD_BOSS_IDS = ["forge-golem", "frostwarden", "blight-treant", "iron-bear"] as const;

export type WildwoodBossId = (typeof WILDWOOD_BOSS_IDS)[number];

const wildwoodBossIds = new Set<string>(WILDWOOD_BOSS_IDS);

function isWildwoodBossId(value: string): value is WildwoodBossId {
  return wildwoodBossIds.has(value);
}

export function sanitizeWildwoodBossId(value: string | null | undefined): WildwoodBossId | null {
  return typeof value === "string" && isWildwoodBossId(value) ? value : null;
}

export function sanitizeWildwoodBossIds(values: readonly string[]): WildwoodBossId[] {
  return values.filter(isWildwoodBossId);
}
