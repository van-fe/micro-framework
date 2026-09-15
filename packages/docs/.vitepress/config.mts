import { defineConfig } from "vitepress";

const documentationSidebar = [
  {
    text: "开始使用",
    collapsed: true,
    items: [
      { text: "快速开始", link: "/guide/getting-started" },
      { text: "为什么选择 Micro Frame", link: "/guide/comparison" },
      { text: "核心概念", link: "/guide/core-concepts" },
      { text: "宿主接入", link: "/guide/host-integration" },
      { text: "微应用接入", link: "/guide/micro-application" },
      { text: "框架适配器", link: "/guide/framework-adapters" },
    ],
  },
  {
    text: "架构",
    collapsed: true,
    items: [
      { text: "架构总览", link: "/architecture/overview" },
      { text: "包与依赖边界", link: "/architecture/package-boundaries" },
      { text: "ADR-001：Realm 与 Shadow DOM", link: "/architecture/adr-001-iframe-realm-shadow-dom" },
      { text: "威胁模型", link: "/architecture/threat-model" },
    ],
  },
  {
    text: "迁移",
    collapsed: true,
    items: [
      { text: "兼容 API 与迁移", link: "/guide/compatibility" },
      { text: "从 qiankun 迁移", link: "/migration/from-qiankun" },
      { text: "从 wujie 迁移", link: "/migration/from-wujie" },
      { text: "迁移工具", link: "/migration/migration-tools" },
    ],
  },
  {
    text: "API 参考",
    collapsed: true,
    items: [
      { text: "Runtime API", link: "/reference/runtime-api" },
      { text: "Angular 与 Webpack", link: "/reference/angular-webpack" },
      { text: "共享依赖与 Import Map", link: "/reference/shared-dependencies" },
      { text: "AppProps 与能力", link: "/reference/app-props" },
      { text: "Document Bridge", link: "/reference/document-bridge" },
      { text: "DOM Guard", link: "/reference/dom-guard" },
      { text: "Vite 插件", link: "/reference/vite-plugin" },
      { text: "部署诊断", link: "/reference/deployment-diagnostics" },
      { text: "CLI 与模板", link: "/reference/cli" },
      { text: "Runtime DevTools", link: "/reference/devtools" },
    ],
  },
  {
    text: "工程状态",
    collapsed: true,
    items: [
      { text: "浏览器支持", link: "/reference/browser-support" },
      { text: "第三方组件兼容矩阵", link: "/reference/component-compatibility" },
      { text: "跨标签页通信", link: "/reference/cross-tab-communication" },
      { text: "宿主统一离线缓存", link: "/reference/offline-cache" },
      { text: "跨域强隔离模式", link: "/reference/strong-isolation" },
      { text: "SSR 与 Hydration", link: "/reference/ssr-hydration" },
      { text: "服务端应用注册", link: "/reference/server-registry" },
      { text: "实现状态", link: "/reference/implementation-status" },
      { text: "测试与门禁", link: "/reference/testing" },
      { text: "发布与外部验收", link: "/reference/release-readiness" },
      { text: "性能与稳定性基准", link: "/reference/benchmarking" },
    ],
  },
  {
    text: "项目",
    collapsed: true,
    items: [
      { text: "路线图", link: "/roadmap" },
    ],
  },
];

export default defineConfig({
  base: process.env.DOCS_BASE || "/",
  lang: "zh-CN",
  title: "Micro Frame",
  titleTemplate: ":title · Micro Frame",
  description: "基于 iframe Realm 与 Shadow DOM 的现代微前端运行时",
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ["meta", { name: "theme-color", content: "#0b8f7c" }],
    ["meta", { name: "color-scheme", content: "light dark" }],
  ],
  markdown: {
    lineNumbers: true,
  },
  themeConfig: {
    siteTitle: "Micro Frame",
    nav: [
      { text: "指南", link: "/guide/getting-started" },
      { text: "为什么选择", link: "/guide/comparison" },
      { text: "交互演示", link: "/demo/" },
      { text: "架构", link: "/architecture/overview" },
      { text: "兼容迁移", link: "/migration/from-qiankun" },
      { text: "参考", link: "/reference/runtime-api" },
      { text: "路线图", link: "/roadmap" },
    ],
    sidebar: documentationSidebar,
    search: {
      provider: "local",
    },
    outline: {
      level: [2, 3],
      label: "本页内容",
    },
    docFooter: {
      prev: "上一页",
      next: "下一页",
    },
    lastUpdated: {
      text: "最后更新",
      formatOptions: {
        dateStyle: "medium",
        timeStyle: "short",
      },
    },
    footer: {
      message: "面向可信内部应用的意外污染隔离，不是恶意代码安全边界。",
      copyright: "Micro Frame documentation",
    },
  },
});
