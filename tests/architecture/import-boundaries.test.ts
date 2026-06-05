import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");
const SRC = join(ROOT, "src");

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      walk(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

function rel(path: string): string {
  return relative(ROOT, path).replaceAll("\\", "/");
}

function filesUnder(prefix: string): string[] {
  return walk(join(SRC, prefix)).map(rel);
}

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function importSources(text: string): string[] {
  const sources: string[] = [];
  const re = /\bfrom\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    sources.push(match[1] ?? "");
  }
  return sources;
}

describe("import boundaries", () => {
  it("lib/ never imports from features/", () => {
    const violations: string[] = [];
    for (const file of filesUnder("lib")) {
      for (const source of importSources(read(file))) {
        if (source.includes("features/")) violations.push(`${file} -> ${source}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("game-data/ never imports battle runtime", () => {
    const violations: string[] = [];
    for (const file of filesUnder("lib/game-data")) {
      for (const source of importSources(read(file))) {
        if (source === "@/lib/battle" || source.startsWith("@/lib/battle/") || source.includes("/lib/battle/")) {
          violations.push(`${file} -> ${source}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("features code outside stores/ does not import run-session-store or active-run-store", () => {
    const violations: string[] = [];
    for (const file of walk(join(SRC, "features/alchemy")).map(rel)) {
      if (file.includes("features/alchemy/shared/stores/")) continue;
      const text = read(file);
      if (/\bfrom\s+['"][^'"]*(?:run-session-store|active-run-store)/.test(text)) {
        violations.push(file);
      }
    }
    expect(violations).toEqual([]);
  });
});
