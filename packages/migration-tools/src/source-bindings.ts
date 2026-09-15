import * as ts from "typescript";

/** Resolve local bindings without loading libraries, imports, or files from disk. */
export function createGlobalReferenceCheck(file: ts.SourceFile): (expression: ts.Expression) => boolean {
  let checker: ts.TypeChecker | undefined;
  return (expression) => {
    let root = expression;
    while (ts.isPropertyAccessExpression(root) || ts.isElementAccessExpression(root)
      || ts.isParenthesizedExpression(root)) {
      root = root.expression;
    }
    if (!ts.isIdentifier(root)) return false;
    checker ??= ts.createProgram({
      rootNames: [file.fileName],
      options: { noLib: true, noResolve: true, allowJs: true },
      host: {
        getSourceFile: (name) => name === file.fileName ? file : undefined,
        getDefaultLibFileName: () => "",
        writeFile: () => {},
        getCurrentDirectory: () => "",
        getDirectories: () => [],
        fileExists: (name) => name === file.fileName,
        readFile: (name) => name === file.fileName ? file.text : undefined,
        getCanonicalFileName: (name) => name,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => "\n",
      },
    }).getTypeChecker();
    return !checker.getSymbolAtLocation(root)?.declarations?.length;
  };
}
