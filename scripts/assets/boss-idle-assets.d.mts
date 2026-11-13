export interface BossIdleMaster {
  source: string;
  target: string;
}

export const bossIdleMasters: BossIdleMaster[];
export const bossIdleAssets: Array<BossIdleMaster & { width: number }>;
export function validateBossIdleRegistry(): Promise<unknown>;
