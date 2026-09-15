import { describe, expect, it, vi } from "vitest";
import { noHostEscapeRule } from "./eslint-plugin";

type Node = Parameters<ReturnType<typeof noHostEscapeRule.create>["MemberExpression"]>[0];

function identifier(name: string): Node {
  return { type: "Identifier", name };
}

function member(object: Node, property: string): Node {
  return { type: "MemberExpression", object, property: identifier(property), computed: false };
}

describe("no-host-escape ESLint rule", () => {
  it("reports host Window escape hatches and Service Worker registration", () => {
    const report = vi.fn();
    const visitors = noHostEscapeRule.create({ report });

    visitors.MemberExpression(member(identifier("window"), "parent"));
    visitors.MemberExpression(member(identifier("top"), "location"));
    visitors.MemberExpression(member(member(identifier("document"), "defaultView"), "parent"));
    visitors.CallExpression({
      type: "CallExpression",
      callee: member(member(identifier("navigator"), "serviceWorker"), "register"),
    });

    expect(report.mock.calls.map(([descriptor]) => descriptor.messageId)).toEqual([
      "hostEscape",
      "hostEscape",
      "hostEscape",
      "serviceWorker",
    ]);
  });

  it("does not report ordinary application-local DOM access", () => {
    const report = vi.fn();
    const visitors = noHostEscapeRule.create({ report });

    visitors.MemberExpression(member(identifier("document"), "body"));
    visitors.MemberExpression(member(identifier("window"), "location"));

    expect(report).not.toHaveBeenCalled();
  });
});
