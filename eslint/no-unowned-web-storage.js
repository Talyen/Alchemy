import { repoRelativePosix } from "./filename.js";
import { restrictedGlobalReferences } from "./restricted-global-references.js";

const ALLOWED_PREFIXES = ["src/features/alchemy/shared/storage/", "src/lib/active-run-session/"];

const ALLOWED_FILES = new Set([
  "src/lib/platform-save-backend.ts",
  "src/startup.ts",
  "src/features/alchemy/shared/stores/error-log-store.ts",
  "src/features/alchemy/shared/utils/dev-mode.ts",
  "src/lib/animation/animation-prefs.ts",
]);

const STORAGE_NAMES = ["localStorage", "sessionStorage", "indexedDB"];

function isAllowed(relative) {
  if (ALLOWED_FILES.has(relative)) return true;
  return ALLOWED_PREFIXES.some((prefix) => relative.startsWith(prefix));
}

/** @type {import("eslint").Rule.RuleModule} */
export const noUnownedWebStorage = {
  meta: {
    type: "problem",
    docs: {
      description: "Keep localStorage/sessionStorage/indexedDB on storage, boot, and named preference seams.",
    },
    schema: [],
    messages: {
      storage:
        "Do not read or write {{name}} here. Persist through shared/storage (or the named boot/preference seam).",
    },
  },
  create(context) {
    const relative = repoRelativePosix(context.filename);
    if (isAllowed(relative)) return {};
    return restrictedGlobalReferences(context, STORAGE_NAMES, (node, name) =>
      context.report({ node, messageId: "storage", data: { name } }),
    );
  },
};
