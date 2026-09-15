/** Rewrites dimension tokens, leaving strings, comments and URL payloads untouched. */
export function resolveApplicationRem(value: string, pixels: number): string {
  return value.replace(/(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\*[\s\S]*?\*\/|url\((?:\\.|[^)])*\))|(?<![\w.-])([+-]?(?:\d*\.)?\d+)rem\b/gi,
    (token, number: string | undefined) => number === undefined ? token : `${Number(number) * pixels}px`);
}

export function unquoteFontFamily(value: string): string {
  return value.trim().replace(/^(["'])(.*)\1$/, "$2");
}

export function renameFontFamilies(value: string, families: ReadonlyMap<string, string>): string {
  let result = value;
  for (const [family, alias] of families) {
    const escaped = family.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`(["'])${escaped}\\1|(?<![\\w-])${escaped}(?![\\w-])`, "gi"), `"${alias}"`);
  }
  return result;
}
