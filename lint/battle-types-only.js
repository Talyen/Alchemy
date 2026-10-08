function isTypeDeclaration(node) {
  return node?.type === "TSInterfaceDeclaration" || node?.type === "TSTypeAliasDeclaration";
}

function isTypeStatement(node) {
  if (isTypeDeclaration(node)) return true;
  if (node.type === "ImportDeclaration") {
    return (
      node.importKind === "type" ||
      (node.specifiers.length > 0 && node.specifiers.every((specifier) => specifier.importKind === "type"))
    );
  }
  if (node.type === "ExportAllDeclaration") return node.exportKind === "type";
  if (node.type === "ExportNamedDeclaration") {
    return (
      isTypeDeclaration(node.declaration) ||
      node.exportKind === "type" ||
      (node.specifiers.length > 0 && node.specifiers.every((specifier) => specifier.exportKind === "type"))
    );
  }
  return false;
}

export const battleTypesOnly = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      executable: "Battle state contracts contain only types. Put executable combat rules in their owning module.",
    },
  },
  create(context) {
    return {
      Program(node) {
        for (const statement of node.body) {
          if (!isTypeStatement(statement)) context.report({ node: statement, messageId: "executable" });
        }
      },
    };
  },
};
