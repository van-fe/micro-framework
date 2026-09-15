import * as ts from "typescript";

export const QIANKUN_MODULES = new Set(["qiankun", "@umijs/plugin-qiankun"]);
export const WUJIE_MODULES = new Set(["wujie", "wujie-vue2", "wujie-vue3"]);
export const COMPATIBLE_QIANKUN_EXPORTS = new Set([
  "addGlobalUncaughtErrorHandler",
  "initGlobalState",
  "loadMicroApp",
  "prefetchApps",
  "registerMicroApps",
  "removeGlobalUncaughtErrorHandler",
  "runAfterFirstMounted",
  "start",
]);

export function sourceScriptKind(filePath: string): ts.ScriptKind {
  if (/\.tsx$/i.test(filePath)) return ts.ScriptKind.TSX;
  if (/\.jsx$/i.test(filePath)) return ts.ScriptKind.JSX;
  if (/\.js$/i.test(filePath)) return ts.ScriptKind.JS;
  if (/\.json$/i.test(filePath)) return ts.ScriptKind.JSON;
  return ts.ScriptKind.TS;
}
