import { verifyDesktopPackage } from "./lib/release-checks.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

if (isMainModule(import.meta.url)) {
  verifyDesktopPackage().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

export { verifyDesktopPackage };
