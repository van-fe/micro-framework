import * as ts from "typescript";
import type { MigrationClassification } from "./diagnostics";
import { createGlobalReferenceCheck } from "./source-bindings";
import {
  COMPATIBLE_QIANKUN_EXPORTS,
  QIANKUN_MODULES,
  sourceScriptKind,
  WUJIE_MODULES,
} from "./source-syntax";
interface SourceRegion {
  readonly content: string;
  readonly offset: number;
  readonly virtualFilePath: string;
}

type AddRange = (start: number, end: number, code: string, classification: MigrationClassification, message: string, recommendation: string) => void;

function propertyPath(node: ts.Node): string | undefined {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isParenthesizedExpression(node)) return propertyPath(node.expression);
  if (ts.isPropertyAccessExpression(node)) {
    const parent = propertyPath(node.expression);
    return parent ? `${parent}.${node.name.text}` : undefined;
  }
  if (ts.isElementAccessExpression(node)
    && node.argumentExpression
    && ts.isStringLiteralLike(node.argumentExpression)) {
    const parent = propertyPath(node.expression);
    return parent ? `${parent}.${node.argumentExpression.text}` : undefined;
  }
  return undefined;
}

export function scanScriptRegion(region: SourceRegion, addRange: AddRange, detectedSources: Set<"qiankun" | "wujie">): void {
    const file = ts.createSourceFile(
      region.virtualFilePath,
      region.content,
      ts.ScriptTarget.Latest,
      true,
      sourceScriptKind(region.virtualFilePath),
    );
    const isGlobalReference = createGlobalReferenceCheck(file);
    const add = (
      node: ts.Node,
      code: string,
      classification: MigrationClassification,
      message: string,
      recommendation: string,
    ) => addRange(
      region.offset + node.getStart(file),
      region.offset + node.getEnd(),
      code,
      classification,
      message,
      recommendation,
    );

    const inspectModule = (node: ts.Node, moduleName: string, importClause?: ts.ImportClause) => {
      if (QIANKUN_MODULES.has(moduleName)) {
        detectedSources.add("qiankun");
        const named = importClause?.namedBindings && ts.isNamedImports(importClause.namedBindings)
          ? importClause.namedBindings.elements.map((element) => (element.propertyName ?? element.name).text)
          : [];
        const safe = Boolean(importClause)
          && !importClause?.name
          && named.length > 0
          && named.every((name) => COMPATIBLE_QIANKUN_EXPORTS.has(name));
        add(
          node,
          safe ? "SRC_QIANKUN_IMPORT" : "SRC_QIANKUN_IMPORT_SHAPE",
          safe ? "automatic" : "review",
          safe
            ? "qiankun 的命名导入可切换到兼容 API。"
            : "默认导入、命名空间导入或插件封装不能只替换模块名。",
          safe
            ? "运行一次 import codemod，再用真实浏览器验证公开合同。"
            : "改为显式导入兼容 API，或直接迁移到 createRuntime。",
        );
      }
      if (WUJIE_MODULES.has(moduleName)) {
        detectedSources.add("wujie");
        add(
          node,
          "SRC_WUJIE_IMPORT",
          "review",
          "wujie 的宿主 API 没有安全的一对一 import 替换。",
          "先用 planWujieMigration 生成 registration，再改为 runtime.mountApp/preloadApps/prewarmApps。",
        );
      }
    };

    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
        inspectModule(node, node.moduleSpecifier.text, node.importClause);
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
        inspectModule(node, node.moduleSpecifier.text);
      } else if (ts.isCallExpression(node)) {
        const path = propertyPath(node.expression);
        if (/^(?:(?:window|globalThis|self)\.)?document\.write(?:ln)?$/.test(path ?? "")
          && isGlobalReference(node.expression)) {
          add(
            node,
            "SRC_DOCUMENT_WRITE",
            "review",
            "document.write/writeln 默认禁用；显式启用可选兼容包后，DOM 写入当前 ShadowRoot，脚本在 iframe Realm 执行。",
            "安装 @micro-framework/document-write 并配置 documentBridge.documentWrite: installDocumentWrite；验证脚本顺序与完整文档行为，独立子 iframe 保留原生 Document。",
          );
        } else if (path === "navigator.serviceWorker.register") {
          add(
            node,
            "SRC_SERVICE_WORKER",
            "unsupported",
            "微应用不能直接注册同源 Service Worker，Runtime 会阻断该调用。",
            "由宿主统一管理离线策略，或移除微应用 Service Worker。",
          );
        } else if (path === "eval" || path === "window.eval" || path === "globalThis.eval") {
          add(
            node,
            "SRC_DYNAMIC_EVAL",
            "unsupported",
            "动态 eval 不符合原生 ESM 和严格 CSP 边界。",
            "把代码生成移动到构建期，发布外部 ESM。",
          );
        }
      } else if (ts.isNewExpression(node)
        && ["Function", "window.Function", "globalThis.Function"].includes(propertyPath(node.expression) ?? "")) {
        add(
          node,
          "SRC_DYNAMIC_FUNCTION",
          "unsupported",
          "Function 构造器依赖 unsafe-eval。",
          "改为静态模块或构建期代码生成。",
        );
      }

      const path = propertyPath(node);
      const parentPathContinues = (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
        && (ts.isPropertyAccessExpression(node.parent) || ts.isElementAccessExpression(node.parent))
        && node.parent.expression === node;
      if (path && !parentPathContinues) {
        if (/^window\.(?:parent|top|frameElement)(?:\.|$)/.test(path)) {
          add(
            node,
            "SRC_HOST_WINDOW_ESCAPE",
            "review",
            `${path} 读取绕过应用协议并依赖同源宿主结构。`,
            "把业务协作迁到 props、Service RPC、Event Channel 或 Capability Broker。",
          );
        } else if (path === "document.cookie") {
          add(
            node,
            "SRC_DOCUMENT_COOKIE",
            "unsupported",
            "Cookie 以 Origin 为边界，不能由 iframe Realm 自动按应用隔离。",
            "由宿主认证 Service 提供受控凭据，不让微应用直接读写 document.cookie。",
          );
        } else if (path.includes("__INJECTED_PUBLIC_PATH_BY_QIANKUN__")) {
          detectedSources.add("qiankun");
          add(
            node,
            "SRC_INJECTED_PUBLIC_PATH",
            "unsupported",
            "运行期注入 public path 不适用于原生 ESM URL 解析。",
            "在 Vite base/构建 manifest 中生成绝对或可解析资源 URL。",
          );
        } else if (path.includes("__POWERED_BY_QIANKUN__")) {
          detectedSources.add("qiankun");
          add(
            node,
            "SRC_QIANKUN_ENV_FLAG",
            "review",
            "qiankun 环境标志不会自动注入。",
            "通过生命周期 props 或显式构建环境判断独立运行/嵌入运行。",
          );
        } else if (path.includes("$wujie")) {
          detectedSources.add("wujie");
          add(
            node,
            "SRC_WUJIE_GLOBAL",
            "review",
            "window.$wujie 的 props/bus 全局协议不会保留。",
            "把 props 改为 mount(props)，把 bus 改为 $runtime.events 或 Service RPC。",
          );
        } else if (/^(?:window\.|globalThis\.)?(?:localStorage|sessionStorage)(?:\.|$)/.test(path)) {
          add(
            node,
            "SRC_WEB_STORAGE",
            "review",
            "旧代码直接使用 Web Storage。",
            "优先迁移到 $runtime.storage；过渡期显式开启 storage.compatibility 对应桥。",
          );
        } else if (/^(?:window\.|globalThis\.)?caches(?:\.|$)/.test(path)) {
          add(
            node,
            "SRC_CACHE_STORAGE",
            "unsupported",
            "Cache Storage 以 Origin 为边界，当前不提供应用级代理。",
            "把离线缓存交给宿主，或改用 $runtime.storage 保存业务状态。",
          );
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
