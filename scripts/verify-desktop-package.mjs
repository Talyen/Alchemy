import { verifyDesktopPackage } from "./lib/release/release-checks.mjs";
import { defineScript } from "./lib/script-run.mjs";

defineScript(import.meta.url, () => verifyDesktopPackage(), { artifacts: true });

export { verifyDesktopPackage };
