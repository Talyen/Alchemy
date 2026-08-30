import { describe, expect, it } from "vitest";
import { enemyBestiary } from "@/lib/game-data";
import { getBossById, getBossEnemy, getCurrentEnemy, rollFreshBossId } from "@/features/alchemy/shared/config/enemies";

describe("getCurrentEnemy", () => {
  it("returns a non-skeleton enemy when no enemy type is specified", () => {
    const enemy = getCurrentEnemy();
    expect(enemy.id).not.toBe("skeleton");
  });

  it("returns a normal enemy when enemy type is normal", () => {
    const enemy = getCurrentEnemy("normal");
    expect(enemy.enemyType).toBe("normal");
  });

  it("prefers normal enemies not encountered this run", () => {
    const normalEnemies = enemyBestiary.filter((enemy) => enemy.enemyType === "normal");
    const remaining = normalEnemies[normalEnemies.length - 1];
    const encountered = normalEnemies.slice(0, -1).map((enemy) => enemy.id);

    expect(getCurrentEnemy("normal", encountered).id).toBe(remaining.id);
  });

  it("prefers elite enemies not encountered this run", () => {
    const eliteEnemies = enemyBestiary.filter((enemy) => enemy.enemyType === "elite");
    const remaining = eliteEnemies[eliteEnemies.length - 1];
    const encountered = eliteEnemies.slice(0, -1).map((enemy) => enemy.id);

    expect(getCurrentEnemy("elite", encountered).id).toBe(remaining.id);
  });

  it("falls back to the requested enemy type after all were encountered", () => {
    const eliteEnemyIds = enemyBestiary.filter((enemy) => enemy.enemyType === "elite").map((enemy) => enemy.id);

    expect(getCurrentEnemy("elite", eliteEnemyIds).enemyType).toBe("elite");
  });
});

describe("getBossEnemy", () => {
  it("returns a random boss from the full boss pool", () => {
    const boss = getBossEnemy();
    expect(boss.enemyType).toBe("boss");
    expect(["forge-golem", "frostwarden", "blight-treant", "iron-bear"]).toContain(boss.id);
  });

  it("prefers bosses not encountered this run", () => {
    const bosses = enemyBestiary.filter((enemy) => enemy.enemyType === "boss");
    const remaining = bosses[bosses.length - 1];
    const encountered = bosses.slice(0, -1).map((enemy) => enemy.id);

    expect(getBossEnemy(encountered).id).toBe(remaining.id);
  });

  it("falls back to the boss pool after all bosses were encountered", () => {
    const bossIds = enemyBestiary.filter((enemy) => enemy.enemyType === "boss").map((enemy) => enemy.id);

    expect(getBossEnemy(bossIds).enemyType).toBe("boss");
  });
});

describe("getBossById", () => {
  it("returns boss entry for valid boss ID", () => {
    const boss = getBossById("frostwarden");
    expect(boss?.id).toBe("frostwarden");
    expect(boss?.enemyType).toBe("boss");
  });

  it("returns undefined for non-boss enemy ID or invalid ID", () => {
    expect(getBossById("skeleton")).toBeUndefined();
    expect(getBossById("unknown-enemy")).toBeUndefined();
  });
});

describe("rollFreshBossId", () => {
  it("returns a valid boss enemy ID", () => {
    const bossId = rollFreshBossId();
    expect(["forge-golem", "frostwarden", "blight-treant", "iron-bear"]).toContain(bossId);
  });
});
