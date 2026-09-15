import { defineConfig, type DefaultTheme } from "vitepress";

const documentationSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: "开始使用",
    collapsed: true,
    items: [
      { text: "快速开始", link: "/guide/getting-started" },
      { text: "为什么选择 Micro Framework", link: "/guide/comparison" },
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

const englishLabels: Record<string, string> = {
  "开始使用": "Getting started",
  "快速开始": "Quick start",
  "为什么选择 Micro Framework": "Why Micro Framework",
  "核心概念": "Core concepts",
  "宿主接入": "Host integration",
  "微应用接入": "Application integration",
  "框架适配器": "Framework adapters",
  "架构": "Architecture",
  "架构总览": "Overview",
  "包与依赖边界": "Package boundaries",
  "ADR-001：Realm 与 Shadow DOM": "ADR-001: Realm and Shadow DOM",
  "威胁模型": "Threat model",
  "迁移": "Migration",
  "兼容 API 与迁移": "Compatibility APIs",
  "从 qiankun 迁移": "From qiankun",
  "从 wujie 迁移": "From wujie",
  "迁移工具": "Migration tools",
  "API 参考": "API reference",
  "Angular 与 Webpack": "Angular and Webpack",
  "共享依赖与 Import Map": "Shared dependencies",
  "AppProps 与能力": "AppProps and capabilities",
  "Vite 插件": "Vite plugin",
  "部署诊断": "Deployment diagnostics",
  "CLI 与模板": "CLI and templates",
  "工程状态": "Engineering status",
  "浏览器支持": "Browser support",
  "第三方组件兼容矩阵": "Component compatibility",
  "跨标签页通信": "Cross-tab communication",
  "宿主统一离线缓存": "Offline caching",
  "跨域强隔离模式": "Cross-origin isolation",
  "SSR 与 Hydration": "SSR and hydration",
  "服务端应用注册": "Server registry",
  "实现状态": "Implementation status",
  "测试与门禁": "Testing and gates",
  "发布与外部验收": "Release readiness",
  "性能与稳定性基准": "Benchmarks",
  "项目": "Project",
  "路线图": "Roadmap"
};

function englishSidebar(items: DefaultTheme.SidebarItem[]): DefaultTheme.SidebarItem[] {
  return items.map((item) => ({
    ...item,
    text: item.text ? englishLabels[item.text] || item.text : undefined,
    link: item.link ? `/en${item.link}` : undefined,
    items: item.items ? englishSidebar(item.items) : undefined,
  }));
}

export default defineConfig({
  base: process.env.DOCS_BASE || "/",
  title: "Micro Framework",
  titleTemplate: ":title · Micro Framework",
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ["meta", { name: "theme-color", content: "#0b8f7c" }],
    ["meta", { name: "color-scheme", content: "light dark" }],
  ],
  markdown: { lineNumbers: true },
  locales: {
    root: {
      label: "简体中文", lang: "zh-CN",
      description: "基于 iframe Realm 与 Shadow DOM 的现代微前端运行时",
      themeConfig: {
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
        langMenuLabel: "切换语言",
        sidebarMenuLabel: "菜单",
        returnToTopLabel: "返回顶部",
        darkModeSwitchLabel: "外观",
        lightModeSwitchTitle: "切换为浅色模式",
        darkModeSwitchTitle: "切换为深色模式",
        outline: { level: [2, 3], label: "本页内容" },
        docFooter: { prev: "上一页", next: "下一页" },
        lastUpdated: { text: "最后更新", formatOptions: { dateStyle: "medium", timeStyle: "short" } },
        footer: {
          message: "面向可信内部应用的意外污染隔离，不是恶意代码安全边界。",
          copyright: "Micro Framework documentation",
        },
        notFound: { title: "页面未找到", quote: "此页面可能已移动，请返回首页继续浏览。", linkLabel: "返回首页", linkText: "返回首页" },
      },
    },
    en: {
      label: "English", lang: "en-US",
      description: "A modern micro-frontend runtime built on iframe Realms and Shadow DOM",
      themeConfig: {
        nav: [
          { text: "Guide", link: "/en/guide/getting-started" },
          { text: "Why Micro Framework", link: "/en/guide/comparison" },
          { text: "Live demo", link: "/en/demo/" },
          { text: "Architecture", link: "/en/architecture/overview" },
          { text: "Migration", link: "/en/migration/from-qiankun" },
          { text: "Reference", link: "/en/reference/runtime-api" },
          { text: "Roadmap", link: "/en/roadmap" },
        ],
        sidebar: englishSidebar(documentationSidebar),
        langMenuLabel: "Change language",
        outline: { level: [2, 3], label: "On this page" },
        docFooter: { prev: "Previous page", next: "Next page" },
        lastUpdated: { text: "Last updated", formatOptions: { dateStyle: "medium", timeStyle: "short" } },
        footer: {
          message: "Isolation against accidental pollution in trusted applications, not a security boundary for malicious code.",
          copyright: "Micro Framework documentation",
        },
      },
    },
  },
  themeConfig: {
    siteTitle: "Micro Framework",
    search: {
      provider: "local",
      options: {
        locales: {
          root: {
            translations: {
              button: { buttonText: "搜索文档", buttonAriaLabel: "搜索文档" },
              modal: {
                displayDetails: "显示详细列表", resetButtonTitle: "清除搜索", backButtonTitle: "返回",
                noResultsText: "没有找到相关结果",
                footer: { selectText: "选择", selectKeyAriaLabel: "回车", navigateText: "切换", navigateUpKeyAriaLabel: "向上", navigateDownKeyAriaLabel: "向下", closeText: "关闭", closeKeyAriaLabel: "Esc" },
              },
            },
          },
        },
      },
    },
  },
});
