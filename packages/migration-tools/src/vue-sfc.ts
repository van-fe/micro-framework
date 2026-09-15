import {
  parse as parseVueSfc,
  type SFCBlock,
  type SFCDescriptor,
} from "@vue/compiler-sfc";

export interface VueScriptRegion {
  readonly content: string;
  readonly offset: number;
  readonly virtualFilePath: string;
}

export interface ParsedVueSfc {
  readonly descriptor: SFCDescriptor;
  readonly errors: readonly (string | SyntaxError)[];
  readonly scripts: readonly VueScriptRegion[];
}

function scriptExtension(block: SFCBlock): string {
  switch (block.lang?.toLowerCase()) {
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
      return block.lang.toLowerCase();
    default:
      return "js";
  }
}

export function isVueSfc(filePath: string): boolean {
  return /\.vue$/i.test(filePath);
}

export function parseVueSource(filePath: string, sourceText: string): ParsedVueSfc {
  const parsed = parseVueSfc(sourceText, {
    filename: filePath,
    sourceMap: false,
  });
  const blocks: SFCBlock[] = [];
  if (parsed.descriptor.script) blocks.push(parsed.descriptor.script);
  if (parsed.descriptor.scriptSetup) blocks.push(parsed.descriptor.scriptSetup);

  return {
    descriptor: parsed.descriptor,
    errors: parsed.errors,
    scripts: blocks.map((block, index) => ({
      content: block.content,
      offset: block.loc.start.offset,
      virtualFilePath: `${filePath}.${index}.${scriptExtension(block)}`,
    })),
  };
}
