import type { RuleTester } from "oxlint/plugins-dev";
export const alchemyPlugin: { meta: { name: string }; rules: Record<string, Parameters<RuleTester["run"]>[1]> };
export default alchemyPlugin;
