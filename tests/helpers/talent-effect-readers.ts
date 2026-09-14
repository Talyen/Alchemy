import ts from "typescript";

/** Find typed manifest reads and key registrations, not textual mentions of their names. */
export function collectTalentEffectReaders(
  checker: ts.TypeChecker,
  manifest: ts.Type,
  sources: readonly ts.SourceFile[],
): Set<string> {
  const fields = new Map(manifest.getProperties().map((symbol) => [symbol.name, symbol]));
  const readers = new Set<string>();
  const isManifestProperty = (symbol: ts.Symbol | undefined, name: string) => {
    const declarations = fields.get(name)?.getDeclarations();
    return declarations?.some((declaration) => symbol?.getDeclarations()?.includes(declaration)) ?? false;
  };
  const record = (type: ts.Type, name: string) => {
    if (isManifestProperty(checker.getPropertyOfType(checker.getNonNullableType(type), name), name)) readers.add(name);
  };
  const isRead = (node: ts.Expression) => {
    const parent = node.parent;
    return !(
      (ts.isBinaryExpression(parent) &&
        parent.left === node &&
        parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) ||
      ts.isDeleteExpression(parent)
    );
  };
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAccessExpression(node) && isRead(node)) {
      record(checker.getTypeAtLocation(node.expression), node.name.text);
    } else if (ts.isElementAccessExpression(node) && isRead(node)) {
      const key = checker.getTypeAtLocation(node.argumentExpression);
      if (key.isStringLiteral()) record(checker.getTypeAtLocation(node.expression), key.value);
    } else if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent) && !node.dotDotDotToken) {
      const key = node.propertyName ?? node.name;
      if (ts.isIdentifier(key) || ts.isStringLiteral(key)) record(checker.getTypeAtLocation(node.parent), key.text);
    } else if (ts.isStringLiteral(node) && fields.has(node.text)) {
      // Typed key tables drive dynamic reads. A free string or comment is not a registration.
      const context = checker.getContextualType(node);
      const members = context?.isUnion() ? context.types.filter((type) => !(type.flags & ts.TypeFlags.Undefined)) : [];
      if (members.length > 1 && members.every((type) => type.isStringLiteral() && fields.has(type.value))) {
        readers.add(node.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  sources.forEach((source) => visit(source));
  return readers;
}
