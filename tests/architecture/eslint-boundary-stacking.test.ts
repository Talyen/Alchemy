import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

interface RestrictedImportsOpts {
  paths?: Array<{ name?: string; importNames?: string[] }>;
  patterns?: Array<{ group?: string | string[]; message?: string }>;
}

interface RestrictedSyntaxEntry {
  selector?: string;
  message?: string;
}

function asRestrictedImports(rule: unknown): RestrictedImportsOpts | null {
  if (!Array.isArray(rule) || rule.length < 2) return null;
  const opts = rule[1];
  if (!opts || typeof opts !== "object") return null;
  return opts as RestrictedImportsOpts;
}

function asRestrictedSyntax(rule: unknown): RestrictedSyntaxEntry[] {
  if (!Array.isArray(rule) || rule.length < 2) return [];
  return rule.slice(1) as RestrictedSyntaxEntry[];
}

function patternGroups(opts: RestrictedImportsOpts | null): string[] {
  if (!opts?.patterns) return [];
  return opts.patterns.flatMap((p) => {
    if (!p.group) return [];
    return Array.isArray(p.group) ? p.group : [p.group];
  });
}

function pathNames(opts: RestrictedImportsOpts | null): string[] {
  if (!opts?.paths) return [];
  return opts.paths.map((p) => p.name).filter((n): n is string => typeof n === "string");
}

function hasGroupContaining(opts: RestrictedImportsOpts | null, needle: string): boolean {
  return patternGroups(opts).some((g) => g.includes(needle));
}

function hasSelectorContaining(entries: RestrictedSyntaxEntry[], needle: string): boolean {
  return entries.some((e) => typeof e.selector === "string" && e.selector.includes(needle));
}

describe("eslint architecture boundary stacking", () => {
  const eslint = new ESLint();

  it("keeps Math.random, Math.floor, and React bans for lib/battle", async () => {
    const cfg = await eslint.calculateConfigForFile("src/lib/battle/card-play.ts");
    const imports = asRestrictedImports(cfg.rules?.["no-restricted-imports"]);
    const syntax = asRestrictedSyntax(cfg.rules?.["no-restricted-syntax"]);

    expect(pathNames(imports)).toEqual(expect.arrayContaining(["react", "zustand"]));
    expect(hasGroupContaining(imports, "features")).toBe(true);
    expect(hasSelectorContaining(syntax, "random")).toBe(true);
    expect(hasSelectorContaining(syntax, "floor")).toBe(true);
  }, 30_000);

  it("keeps facade / run-domain-store ban for run-loop/battle", async () => {
    const cfg = await eslint.calculateConfigForFile(
      "src/features/alchemy/run-loop/battle/battle-presentation-store.ts",
    );
    const imports = asRestrictedImports(cfg.rules?.["no-restricted-imports"]);

    expect(hasGroupContaining(imports, "run-domain-store")).toBe(true);
    expect(hasGroupContaining(imports, "run-transitions")).toBe(true);
    expect(hasGroupContaining(imports, "run-profile-store")).toBe(true);
    expect(hasGroupContaining(imports, "screens")).toBe(true);
    expect(patternGroups(imports)).toEqual(
      expect.arrayContaining([
        "**/features/alchemy/meta/screens/**",
        "**/features/alchemy/run-setup/screens/**",
        "**/features/alchemy/run-loop/screens/**",
      ]),
    );
  });

  it("keeps barrel + domain-store bans for meta screens alongside meta↛run-loop", async () => {
    const cfg = await eslint.calculateConfigForFile("src/features/alchemy/meta/screens/menu-screen.tsx");
    const imports = asRestrictedImports(cfg.rules?.["no-restricted-imports"]);

    expect(hasGroupContaining(imports, "run-domain-store")).toBe(true);
    expect(hasGroupContaining(imports, "run-loop")).toBe(true);
    expect(hasGroupContaining(imports, "@/lib/battle/*")).toBe(true);
  });

  it("keeps screen→run bans on meta screens without applying them to non-screen meta", async () => {
    const screenCfg = await eslint.calculateConfigForFile("src/features/alchemy/meta/screens/menu-screen.tsx");
    const nonScreenCfg = await eslint.calculateConfigForFile("src/features/alchemy/meta/talents/talent-positions.ts");
    const screenImports = asRestrictedImports(screenCfg.rules?.["no-restricted-imports"]);
    const nonScreenImports = asRestrictedImports(nonScreenCfg.rules?.["no-restricted-imports"]);

    expect(hasGroupContaining(screenImports, "run-loop/run")).toBe(true);
    expect(hasGroupContaining(nonScreenImports, "run-loop")).toBe(true);
    expect(hasGroupContaining(nonScreenImports, "run-loop/run")).toBe(false);
  });

  it("keeps barrel bans for shared/ui alongside ui-store isolation", async () => {
    const cfg = await eslint.calculateConfigForFile("src/features/alchemy/shared/ui/game-menu.tsx");
    const imports = asRestrictedImports(cfg.rules?.["no-restricted-imports"]);

    expect(hasGroupContaining(imports, "battle-store")).toBe(true);
    expect(hasGroupContaining(imports, "@/lib/battle/*")).toBe(true);
  });

  it("keeps React.lazy ban for screen-routes without wiping facade bans", async () => {
    const cfg = await eslint.calculateConfigForFile("src/app/screen-routes/index.tsx");
    const imports = asRestrictedImports(cfg.rules?.["no-restricted-imports"]);

    expect(pathNames(imports)).toContain("react");
    expect(imports?.paths?.some((p) => p.name === "react" && p.importNames?.includes("lazy"))).toBe(true);
    expect(hasGroupContaining(imports, "run-domain-store")).toBe(true);
  });

  it("bans run-setup → run-loop and keeps facade bans", async () => {
    const cfg = await eslint.calculateConfigForFile("src/features/alchemy/run-setup/run/content-system-navigation.ts");
    const imports = asRestrictedImports(cfg.rules?.["no-restricted-imports"]);

    expect(hasGroupContaining(imports, "run-loop")).toBe(true);
    expect(hasGroupContaining(imports, "run-domain-store")).toBe(true);
  });

  it("bans run-loop → run-setup and keeps orchestration bans for battle", async () => {
    const cfg = await eslint.calculateConfigForFile("src/features/alchemy/run-loop/battle/battle-init.ts");
    const imports = asRestrictedImports(cfg.rules?.["no-restricted-imports"]);

    expect(hasGroupContaining(imports, "run-setup")).toBe(true);
    expect(hasGroupContaining(imports, "screens")).toBe(true);
    expect(hasGroupContaining(imports, "run-domain-store")).toBe(true);
  });

  it("keeps screen→run bans for run-loop screens without applying them to shop", async () => {
    const screenCfg = await eslint.calculateConfigForFile(
      "src/features/alchemy/run-loop/screens/destination-screen.tsx",
    );
    const shopCfg = await eslint.calculateConfigForFile("src/features/alchemy/run-loop/shop/create-shop-actions.ts");
    const screenImports = asRestrictedImports(screenCfg.rules?.["no-restricted-imports"]);
    const shopImports = asRestrictedImports(shopCfg.rules?.["no-restricted-imports"]);

    expect(hasGroupContaining(screenImports, "run-loop/run")).toBe(true);
    expect(hasGroupContaining(shopImports, "run-setup")).toBe(true);
    expect(hasGroupContaining(shopImports, "run-loop/run")).toBe(false);
  });
});
