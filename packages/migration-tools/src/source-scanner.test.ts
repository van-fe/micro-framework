import { describe, expect, it } from "vitest";
import { codemodMigrationSource } from "./source-codemod";
import { scanMigrationSource } from "./source-scanner";

describe("migration source scanner", () => {
  it("classifies safe qiankun imports and browser compatibility review patterns", () => {
    const result = scanMigrationSource({
      filePath: "src/host.ts",
      sourceText: `
        import { registerMicroApps, start } from "qiankun";
        const draft = localStorage.getItem("draft");
        window.parent.document.querySelector("#shell");
        document.write("<script>legacy()</script>");
      `,
    });

    expect(result.status).toBe("review");
    expect(result.detectedSources).toEqual(["qiankun"]);
    expect(result.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "SRC_QIANKUN_IMPORT",
      "SRC_WEB_STORAGE",
      "SRC_HOST_WINDOW_ESCAPE",
      "SRC_DOCUMENT_WRITE",
    ]));
    expect(result.diagnostics.every(({ location }) => location.line > 0 && location.column > 0)).toBe(true);
  });

  it("requires compatibility review for global document writes without rewriting source", () => {
    const sourceText = `
      document.write("<p>one</p>");
      window.document.writeln("two");
      globalThis["document"]["write"]("three");
      self.document?.writeln?.("four");
      (document).write("five");
    `;
    const result = codemodMigrationSource({ filePath: "src/legacy.js", sourceText });

    expect(result.changed).toBe(false);
    expect(result.output).toBe(sourceText);
    expect(result.scan.status).toBe("review");
    expect(result.scan.diagnostics).toHaveLength(5);
    expect(result.scan.diagnostics.every(({ code, classification, severity }) =>
      code === "SRC_DOCUMENT_WRITE" && classification === "review" && severity === "warning",
    )).toBe(true);
    expect(JSON.stringify(result.scan.diagnostics)).toContain("@micro-framework/document-write");
    expect(JSON.stringify(result.scan.diagnostics)).toContain("默认禁用");
  });

  it("does not confuse local bindings or independent iframe documents with the app document", () => {
    const result = scanMigrationSource({
      filePath: "src/local.ts",
      sourceText: `
        import document from "./printer";
        document.write("local import");
        function render(window, { self }) {
          window.document.write("local parameter");
          self.document.writeln("local binding");
        }
        {
          const globalThis = { document };
          globalThis.document.write("local variable");
        }
        iframe.contentDocument.write("native child document");
      `,
    });

    expect(result.status).toBe("ready");
    expect(result.diagnostics).toEqual([]);
  });

  it("keeps a global write diagnostic outside a shadowing scope", () => {
    const result = scanMigrationSource({
      filePath: "src/scopes.ts",
      sourceText: `
        function render(document) { document.write("local"); }
        { const document = printer; document.write("local block"); }
        document.write("application");
        function load() { window.document.writeln("application"); }
      `,
    });

    expect(result.status).toBe("review");
    expect(result.diagnostics.map(({ location }) => location.line)).toEqual([4, 5]);
  });

  it("uses the TypeScript syntax tree instead of matching comments or string contents", () => {
    const result = scanMigrationSource({
      filePath: "src/clean.ts",
      sourceText: `
        // document.write("ignored")
        const note = "window.parent and localStorage are documentation";
        export const value = note.length;
      `,
    });

    expect(result.status).toBe("ready");
    expect(result.diagnostics).toEqual([]);
  });

  it("requires review for wujie globals and host API imports", () => {
    const result = scanMigrationSource({
      filePath: "src/wujie-host.ts",
      sourceText: `
        import { startApp } from "wujie";
        window.$wujie?.bus.$emit("changed", { id: 1 });
      `,
    });

    expect(result.status).toBe("review");
    expect(result.detectedSources).toEqual(["wujie"]);
    expect(result.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "SRC_WUJIE_IMPORT", "SRC_WUJIE_GLOBAL",
    ]));
  });

  it("rewrites only compatible named qiankun imports", () => {
    const safe = codemodMigrationSource({
      filePath: "src/host.ts",
      sourceText: `import { registerMicroApps, start as boot } from "qiankun";`,
    });
    const unsafe = codemodMigrationSource({
      filePath: "src/legacy.ts",
      sourceText: `import qiankun from "qiankun";`,
    });

    expect(safe.changed).toBe(true);
    expect(safe.output).toContain(`from "${"@micro-framework/compat-api"}"`);
    expect(unsafe.changed).toBe(false);
    expect(unsafe.scan.diagnostics.map(({ code }) => code)).toContain("SRC_QIANKUN_IMPORT_SHAPE");
  });

  it("scans Vue SFC script, template expressions, and style selectors with original locations", () => {
    const result = scanMigrationSource({
      filePath: "src/LegacyPanel.vue",
      sourceText: `<script setup lang="ts">
import { registerMicroApps } from "qiankun";
const saved = localStorage.getItem("panel");
</script>
<template>
  <button @click="$wujie?.bus.$emit('open')">{{ window.parent.document.title }}</button>
</template>
<style scoped>
body .panel { color: red }
.shell >>> .button { color: blue }
:global(.legacy-popup) { z-index: 1 }
</style>`,
    });

    expect(result.status).toBe("review");
    expect(result.detectedSources).toEqual(["qiankun", "wujie"]);
    expect(result.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "SRC_QIANKUN_IMPORT",
      "SRC_WEB_STORAGE",
      "SRC_WUJIE_GLOBAL",
      "SRC_HOST_WINDOW_ESCAPE",
      "SRC_VUE_DOCUMENT_SELECTOR",
      "SRC_VUE_LEGACY_DEEP_SELECTOR",
      "SRC_VUE_GLOBAL_SELECTOR",
    ]));
    expect(result.diagnostics.find(({ code }) => code === "SRC_WUJIE_GLOBAL")?.location.line).toBe(6);
    expect(result.diagnostics.find(({ code }) => code === "SRC_VUE_DOCUMENT_SELECTOR")?.location.line).toBe(9);
  });

  it("ignores Vue template text and CSS comments while rewriting only an SFC script import", () => {
    const sourceText = `<script setup>
import { registerMicroApps, start } from "qiankun";
const note = "window.parent and localStorage";
</script>
<template><!-- {{ window.parent }} --><p>document.cookie and $wujie</p></template>
<style>/* body .ignored {} */ .panel { color: red }</style>`;
    const result = codemodMigrationSource({ filePath: "src/App.vue", sourceText });

    expect(result.changed).toBe(true);
    expect(result.output).toContain(`from "${"@micro-framework/compat-api"}"`);
    expect(result.output).toContain("document.cookie and $wujie");
    expect(result.scan.status).toBe("ready");
    expect(result.scan.diagnostics.map(({ code }) => code)).toEqual(["SRC_QIANKUN_IMPORT"]);
  });

  it("requires review when an SFC block is external and blocks structurally invalid SFC input", () => {
    const external = scanMigrationSource({
      filePath: "src/External.vue",
      sourceText: `<template src="./view.html"></template><script src="./logic.ts"></script>`,
    });
    const invalid = scanMigrationSource({
      filePath: "src/Invalid.vue",
      sourceText: `<template><div></template>`,
    });

    expect(external.status).toBe("review");
    expect(external.diagnostics.map(({ code }) => code)).toEqual([
      "SRC_VUE_EXTERNAL_BLOCK",
      "SRC_VUE_EXTERNAL_BLOCK",
    ]);
    expect(invalid.status).toBe("blocked");
    expect(invalid.diagnostics.map(({ code }) => code)).toContain("SRC_VUE_PARSE_ERROR");
  });

  it("parses SCSS, Less, indented Sass, and Stylus selectors with source locations", () => {
    const result = scanMigrationSource({
      filePath: "src/Preprocessed.vue",
      sourceText: `<template><main class="panel" /></template>
<style lang="scss">
$accent: red;
body { .panel { color: $accent; } }
</style>
<style lang="less">
@accent: blue;
:root { .panel { color: @accent; } }
</style>
<style lang="sass">
body
  color: red
</style>
<style lang="stylus">
:root
  color blue
</style>
<style lang="unknown-style">
html
  color: green
</style>`,
    });

    const documentSelectors = result.diagnostics.filter(({ code }) => code === "SRC_VUE_DOCUMENT_SELECTOR");
    expect(result.status).toBe("review");
    expect(documentSelectors).toHaveLength(4);
    expect(documentSelectors.map(({ location }) => location.line)).toEqual([
      4,
      8,
      11,
      15,
    ]);
    expect(result.diagnostics.map(({ code }) => code)).toContain("SRC_VUE_STYLE_LANGUAGE");
    expect(result.diagnostics.map(({ code }) => code)).not.toContain("SRC_VUE_STYLE_PARSE_ERROR");
  });
});
