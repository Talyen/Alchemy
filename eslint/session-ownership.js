import path from "node:path";

// These are shipping application adapters, even where they live beside a feature.
export const APPLICATION_SESSION_ADAPTERS = Object.freeze([
  "src/app/screen-routes/run-loop-routes.tsx",
  "src/app/screen-routes/meta-routes.tsx",
  "src/app/use-dev-shortcuts.ts",
  "src/app/use-app-navigation.ts",
  "src/app/use-card-inspection.ts",
  "src/app/use-app-effects.ts",
  "src/app/use-alchemy-bootstrap.ts",
  "src/app/save-write-notice.tsx",
  "src/app/use-app-save-state.ts",
  "src/features/alchemy/shell/use-alchemy-run-controller.ts",
  "src/features/alchemy/shell/use-battle-controller.ts",
  "src/features/alchemy/shell/use-screen-transitions.ts",
  "src/features/alchemy/meta/screens/armory/use-armory-controller.ts",
  "src/features/alchemy/run-loop/battle/battle-presentation-store.ts",
  "src/features/alchemy/shared/stores/gameplay-state-store.ts",
  "src/features/alchemy/shared/stores/settings-store.ts",
  "src/features/alchemy/shared/stores/use-run-screen-data.ts",
]);

function isGameSessionType(type, names) {
  if (!type) return false;
  if (type.type === "TSTypeReference") {
    return type.typeName.type === "Identifier"
      ? names.has(type.typeName.name)
      : type.typeName.right.name === "GameSession";
  }
  if (type.type === "TSImportType") return type.qualifier?.name === "GameSession";
  if (type.type === "TSUnionType") return type.types.some((entry) => isGameSessionType(entry, names));
  return false;
}

export const sessionOwnership = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      application:
        "The application session belongs to shipping adapters. Bind an explicit GameSession through a capability factory.",
      required: "GameSession parameters must be required and have no fallback. Bind the session at composition.",
    },
  },
  create(context) {
    const file = path.relative(context.cwd, context.filename).replaceAll("\\", "/");
    const applicationAdapter = APPLICATION_SESSION_ADAPTERS.includes(file);
    const names = new Set(["GameSession"]);
    function checkParameters(node) {
      for (const parameter of node.params ?? []) {
        const binding = parameter.type === "AssignmentPattern" ? parameter.left : parameter;
        if (
          isGameSessionType(binding.typeAnnotation?.typeAnnotation, names) &&
          (binding.optional || parameter.type === "AssignmentPattern")
        ) {
          context.report({ node: parameter, messageId: "required" });
        }
      }
    }
    function checkImport(node) {
      if (!applicationAdapter && /(?:^|\/)application-session(?:\.[jt]sx?)?$/.test(node.source.value)) {
        context.report({ node, messageId: "application" });
      }
    }
    return {
      ImportDeclaration(node) {
        checkImport(node);
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportSpecifier" && specifier.imported.name === "GameSession")
            names.add(specifier.local.name);
        }
      },
      ExportNamedDeclaration(node) {
        if (node.source) checkImport(node);
      },
      ExportAllDeclaration: checkImport,
      ImportExpression(node) {
        if (node.source.type === "Literal") checkImport(node);
      },
      FunctionDeclaration: checkParameters,
      FunctionExpression: checkParameters,
      ArrowFunctionExpression: checkParameters,
      TSFunctionType: checkParameters,
      TSMethodSignature: checkParameters,
    };
  },
};
