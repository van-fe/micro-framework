interface AstNode {
  readonly type: string;
  readonly name?: string;
  readonly computed?: boolean;
  readonly object?: AstNode;
  readonly property?: AstNode;
  readonly callee?: AstNode;
  readonly value?: string;
}

interface RuleContext {
  report(descriptor: { node: AstNode; messageId: "hostEscape" | "serviceWorker"; data?: { access: string } }): void;
}

function propertyName(node: AstNode | undefined): string | undefined {
  if (!node) return undefined;
  if (node.type === "Identifier") return node.name;
  if (node.type === "Literal") return node.value;
  return undefined;
}

function memberPath(node: AstNode | undefined): string | undefined {
  if (!node) return undefined;
  if (node.type === "Identifier") return node.name;
  if (node.type !== "MemberExpression") return undefined;
  const object = memberPath(node.object);
  const property = propertyName(node.property);
  return object && property ? `${object}.${property}` : undefined;
}

export const noHostEscapeRule = {
  meta: {
    type: "problem",
    docs: { description: "Report micro-application access to host escape hatches." },
    schema: [],
    messages: {
      hostEscape: "{{access}} reaches outside the application Realm. Use runtime services or capabilities.",
      serviceWorker: "Service Worker registration is disabled inside a micro application Realm.",
    },
  },
  create(context: RuleContext) {
    return {
      MemberExpression(node: AstNode) {
        const path = memberPath(node);
        const objectPath = memberPath(node.object);
        const property = propertyName(node.property);
        const directWindowEscape = ["window", "self", "globalThis"].includes(objectPath ?? "")
          && ["parent", "top", "frameElement"].includes(property ?? "");
        const indirectEscape = ["parent", "top"].includes(objectPath ?? "")
          || (property === "parent" && objectPath === "document.defaultView");
        if (path && (directWindowEscape || indirectEscape)) {
          context.report({ node, messageId: "hostEscape", data: { access: path } });
        }
      },
      CallExpression(node: AstNode) {
        if (memberPath(node.callee) === "navigator.serviceWorker.register") {
          context.report({ node, messageId: "serviceWorker" });
        }
      },
    };
  },
};

const plugin = {
  rules: { "no-host-escape": noHostEscapeRule },
  configs: {
    recommended: {
      rules: { "micro-frame/no-host-escape": "warn" },
    },
  },
};

export default plugin;
