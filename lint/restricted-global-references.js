const GLOBAL_OBJECTS = new Set(["globalThis", "window", "self"]);

function propertyName(node, computed) {
  if (!computed && node.type === "Identifier") return node.name;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return null;
}

function isTypeQuery(node) {
  while (node.parent?.type === "TSQualifiedName") node = node.parent;
  // `typeof fetch` resolves a value symbol, but only describes its type.
  return node.parent?.type === "TSTypeQuery";
}

/**
 * Inspect runtime references to browser globals, including capturing an API for
 * later use. Scope references exclude property names, declarations, and types;
 * local bindings must not be mistaken for browser APIs based on their spelling.
 * Both network and storage rules use this without requiring a TypeScript project.
 */
export function restrictedGlobalReferences(context, names, report) {
  const restrictions = new Set(names);
  const reported = new Set();

  function inspect(node, parts) {
    const name = parts.join(".");
    if (restrictions.has(name)) {
      const position = node.range[0];
      if (!reported.has(position)) {
        reported.add(position);
        report(node, name);
      }
      return;
    }
    if (name && !names.some((restricted) => restricted.startsWith(`${name}.`))) return;

    if (node.type === "ObjectPattern") {
      for (const property of node.properties) {
        if (property.type !== "Property") continue;
        const key = propertyName(property.key, property.computed);
        if (key === null) continue;
        const next = parts.length === 0 && GLOBAL_OBJECTS.has(key) ? [] : [...parts, key];
        if (restrictions.has(next.join("."))) inspect(property.key, next);
        else inspect(property.value.type === "AssignmentPattern" ? property.value.left : property.value, next);
      }
      return;
    }

    const parent = node.parent;
    if (parent?.type === "MemberExpression" && parent.object === node) {
      const key = propertyName(parent.property, parent.computed);
      if (key === null) return;
      const next = parts.length === 0 && GLOBAL_OBJECTS.has(key) ? [] : [...parts, key];
      if (restrictions.has(next.join("."))) inspect(parent.property, next);
      else inspect(parent, next);
    } else if (
      parent?.type === "ChainExpression" ||
      ((parent?.type === "TSAsExpression" ||
        parent?.type === "TSNonNullExpression" ||
        parent?.type === "TSSatisfiesExpression") &&
        parent.expression === node)
    ) {
      inspect(parent, parts);
    } else if (parent?.type === "VariableDeclarator" && parent.init === node && parent.id.type === "ObjectPattern") {
      inspect(parent.id, parts);
    } else if (
      parent?.type === "AssignmentExpression" &&
      parent.right === node &&
      parent.left.type === "ObjectPattern"
    ) {
      inspect(parent.left, parts);
    }
  }

  return {
    "Program:exit"() {
      for (const scope of context.sourceCode.scopeManager.scopes) {
        for (const reference of scope.references) {
          if (
            reference.isValueReference === false ||
            reference.resolved?.defs.length ||
            isTypeQuery(reference.identifier)
          )
            continue;
          const node = reference.identifier;
          inspect(node, GLOBAL_OBJECTS.has(node.name) ? [] : [node.name]);
        }
      }
    },
  };
}
