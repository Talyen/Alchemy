import { repoRelativePosix } from "./filename.js";

const ALLOWED_PREFIXES = ["src/features/alchemy/shared/storage/", "src/lib/validation/", "src/lib/active-run-session/"];

const ALLOWED_FILES = new Set([
  "src/lib/platform-save-backend.ts",
  "src/startup.ts",
  "src/features/alchemy/shared/stores/error-log-store.ts",
  "src/features/alchemy/shared/utils/dev-mode.ts",
  "src/lib/animation/animation-prefs.ts",
]);

const STORAGE_NAMES = new Set(["localStorage", "sessionStorage"]);

function isAllowed(relative) {
  if (ALLOWED_FILES.has(relative)) return true;
  return ALLOWED_PREFIXES.some((prefix) => relative.startsWith(prefix));
}

function isStorageIdentifier(node) {
  return node.type === "Identifier" && STORAGE_NAMES.has(node.name);
}

function isStorageMember(node) {
  return (
    node.type === "MemberExpression" &&
    !node.computed &&
    node.property.type === "Identifier" &&
    STORAGE_NAMES.has(node.property.name)
  );
}

/** @type {import("eslint").Rule.RuleModule} */
export const noUnownedWebStorage = {
  meta: {
    type: "problem",
    docs: {
      description: "Keep localStorage/sessionStorage on storage, validation, boot, and named preference seams.",
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
    const report = (node, name) => context.report({ node, messageId: "storage", data: { name } });
    return {
      Identifier(node) {
        if (!isStorageIdentifier(node)) return;
        const parent = node.parent;
        if (parent && "key" in parent && parent.key === node) return;
        if (parent?.type === "MemberExpression" && parent.property === node) return;
        report(node, node.name);
      },
      MemberExpression(node) {
        if (!isStorageMember(node)) return;
        report(node.property, node.property.name);
      },
    };
  },
};
