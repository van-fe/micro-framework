/// <reference path="./postcss-custom-syntaxes.d.ts" />

import {
  baseParse as parseVueTemplate,
  NodeTypes,
  type DirectiveNode,
  type ElementNode,
  type RootNode,
  type TemplateChildNode,
} from "@vue/compiler-dom";
import { parse as parseCss, type Root } from "postcss";
import * as parseLess from "postcss-less";
import parseSass from "postcss-sass";
import { parse as parseScss } from "postcss-scss";
import parseStylus from "postcss-styl";
import type { MigrationClassification } from "./diagnostics";
import { parseVueSource, type VueScriptRegion } from "./vue-sfc";

type AddDiagnostic = (
  start: number,
  end: number,
  code: string,
  classification: MigrationClassification,
  message: string,
  recommendation: string,
) => void;

export interface VueSfcScannerHooks {
  readonly addDiagnostic: AddDiagnostic;
  readonly scanScriptRegion: (region: VueScriptRegion) => void;
}

const supportedStyleLanguages = new Set([
  "css",
  "pcss",
  "postcss",
  "scss",
  "sass",
  "less",
  "styl",
  "stylus",
]);

function sourceOffset(
  sourceText: string,
  position: { readonly offset?: number; readonly line: number; readonly column: number } | undefined,
): number {
  if (!position) return 0;
  if (typeof position.offset === "number") return position.offset;

  let offset = 0;
  for (let line = 1; line < position.line; line += 1) {
    const newline = sourceText.indexOf("\n", offset);
    if (newline < 0) return sourceText.length;
    offset = newline + 1;
  }
  return Math.min(offset + Math.max(0, position.column - 1), sourceText.length);
}

function parseStyle(language: string, sourceText: string): Root {
  if (language === "scss") return parseScss(sourceText, { from: undefined }) as Root;
  if (language === "sass") return parseSass.parse(sourceText, { from: undefined }) as Root;
  if (language === "less") return parseLess.parse(sourceText, { from: undefined }) as Root;
  if (language === "styl" || language === "stylus") {
    return parseStylus.parse(sourceText, { from: undefined }) as Root;
  }
  return parseCss(sourceText, { from: undefined });
}

function compilerErrorRange(error: SyntaxError): { start: number; end: number } {
  const located = error as SyntaxError & {
    loc?: { start?: { offset?: number }; end?: { offset?: number } };
  };
  const start = located.loc?.start?.offset ?? 0;
  return { start, end: located.loc?.end?.offset ?? start };
}

export function scanVueSfcSource(
  filePath: string,
  sourceText: string,
  hooks: VueSfcScannerHooks,
): void {
  const parsed = parseVueSource(filePath, sourceText);
  for (const error of parsed.errors) {
    const range = typeof error === "string" ? { start: 0, end: 0 } : compilerErrorRange(error);
    hooks.addDiagnostic(
      range.start,
      range.end,
      "SRC_VUE_PARSE_ERROR",
      "unsupported",
      `Vue SFC 无法完整解析：${typeof error === "string" ? error : error.message}`,
      "先修复 SFC 结构或语法错误，再运行迁移扫描。",
    );
  }
  for (const region of parsed.scripts) hooks.scanScriptRegion(region);

  const externalBlocks = [
    parsed.descriptor.template,
    parsed.descriptor.script,
    parsed.descriptor.scriptSetup,
    ...parsed.descriptor.styles,
  ].filter((block) => block?.src);
  for (const block of externalBlocks) {
    if (!block) continue;
    hooks.addDiagnostic(
      block.loc.start.offset,
      block.loc.end.offset,
      "SRC_VUE_EXTERNAL_BLOCK",
      "review",
      `Vue SFC 的外部 ${block.type} 块不会随当前文件展开扫描。`,
      "把 src 指向的文件同时交给 scan-source，或改为内联 SFC 块后复查。",
    );
  }

  const template = parsed.descriptor.template;
  if (template && !template.src) {
    try {
      const root = parseVueTemplate(template.content, { comments: false });
      const inspectExpression = (expression: DirectiveNode["exp"]) => {
        if (!expression || expression.type !== NodeTypes.SIMPLE_EXPRESSION || !expression.content.trim()) return;
        hooks.scanScriptRegion({
          content: expression.content,
          offset: template.loc.start.offset + expression.loc.start.offset,
          virtualFilePath: `${filePath}.template.ts`,
        });
      };
      const visitTemplateNode = (node: RootNode | TemplateChildNode): void => {
        if (node.type === NodeTypes.ROOT) {
          for (const child of node.children) visitTemplateNode(child);
        } else if (node.type === NodeTypes.ELEMENT) {
          visitElement(node);
        } else if (node.type === NodeTypes.INTERPOLATION) {
          inspectExpression(node.content);
        }
      };
      const visitElement = (element: ElementNode) => {
        for (const property of element.props) {
          if (property.type !== NodeTypes.DIRECTIVE) continue;
          inspectExpression(property.exp);
          if (property.arg?.type === NodeTypes.SIMPLE_EXPRESSION && !property.arg.isStatic) {
            inspectExpression(property.arg);
          }
        }
        for (const child of element.children) visitTemplateNode(child);
      };
      visitTemplateNode(root);
    } catch (error) {
      hooks.addDiagnostic(
        template.loc.start.offset,
        template.loc.end.offset,
        "SRC_VUE_TEMPLATE_PARSE_ERROR",
        "unsupported",
        `Vue template 无法完整解析：${error instanceof Error ? error.message : String(error)}`,
        "先修复 template 语法，再运行迁移扫描。",
      );
    }
  }

  for (const style of parsed.descriptor.styles) {
    if (style.src) continue;
    const language = style.lang?.toLowerCase() ?? "css";
    if (!supportedStyleLanguages.has(language)) {
      hooks.addDiagnostic(
        style.loc.start.offset,
        style.loc.end.offset,
        "SRC_VUE_STYLE_LANGUAGE",
        "review",
        `Vue style 使用尚未内置语法树解析器的 ${JSON.stringify(language)} 预处理器。`,
        "把预处理后的 CSS 同时交给 scan-source，或人工复查 Document 根级与全局选择器。",
      );
      continue;
    }
    try {
      const root = parseStyle(language, style.content);
      root.walkRules((rule) => {
        const selector = rule.selector;
        const start = style.loc.start.offset + sourceOffset(style.content, rule.source?.start);
        const end = start + selector.length;
        if (/(^|,)\s*(?:html|body|:root)(?=$|[\s>+~.#[:])/i.test(selector)) {
          hooks.addDiagnostic(
            start,
            end,
            "SRC_VUE_DOCUMENT_SELECTOR",
            "review",
            `SFC 样式选择器 ${JSON.stringify(selector)} 依赖 Document 根节点，在 ShadowRoot 中不会匹配。`,
            "把根级变量迁到 CSS Token 桥，其他规则改为应用 surface 或组件根选择器。",
          );
        }
        if (/(?:>>>|\/deep\/)/.test(selector)) {
          hooks.addDiagnostic(
            start,
            end,
            "SRC_VUE_LEGACY_DEEP_SELECTOR",
            "review",
            `SFC 样式仍使用旧式深度选择器 ${JSON.stringify(selector)}。`,
            "按当前 Vue 编译器改为 :deep()，并在 ShadowRoot 内验证组件库结构。",
          );
        }
        if (/(?:^|[^:]):global\(|::v-global\(/.test(selector)) {
          hooks.addDiagnostic(
            start,
            end,
            "SRC_VUE_GLOBAL_SELECTOR",
            "review",
            `SFC 样式使用全局选择器 ${JSON.stringify(selector)}。`,
            "确认目标仍位于当前应用 ShadowRoot；宿主样式协作改用显式 CSS Token。",
          );
        }
      });
    } catch (error) {
      hooks.addDiagnostic(
        style.loc.start.offset,
        style.loc.end.offset,
        "SRC_VUE_STYLE_PARSE_ERROR",
        "unsupported",
        `Vue style 无法完整解析：${error instanceof Error ? error.message : String(error)}`,
        "先修复 CSS/预处理器语法，或把预处理后的 CSS 交给扫描器复查。",
      );
    }
  }
}
