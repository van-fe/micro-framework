---
title: 履约运营台交互演示
description: 在文档中直接体验由 Vanilla、React 与 Vue 微应用共同组成的真实业务页面。
outline: false
sidebar: false
aside: false
---

<script setup lang="ts">
import DemoPreview from "../.vitepress/theme/DemoPreview.vue";
</script>

# 履约运营台交互演示

这个运营台模拟电商履约团队的真实日常：宿主负责全局导航、市场筛选与核心指标，
四个独立微应用分别承载订单处置、营收分析、现代客户风险和传统系统迁移。它们拥有各自的 iframe Realm、
模块图和 ShadowRoot，但组合后保持一致的产品体验。

演示默认使用当前文档语言。宿主右上角提供中文/English 切换，并通过生命周期 update 将 locale 同步给全部微应用。
React 示例使用 Ant Design，Vue 3 使用 Element Plus，Vue 2 使用 Element UI。
四个微应用都提供了可操作弹窗。它们默认覆盖整个宿主视口，同时弹层 DOM 与样式仍归各自
ShadowRoot 所有；显式指定容器时才会按容器范围定位。这可以直接验证 React Portal、
Vue Teleport、Element UI `append-to-body` 与原生 `dialog` 的默认全局行为。

<DemoPreview />

::: tip 本地运行
在仓库根目录执行 `bun run dev`，然后打开本页。默认情况下，文档运行于
`127.0.0.1:5178`，宿主和四个微应用运行于 `5173–5176` 与 `5179`。
:::

线上演示与文档一起部署，使用当前站点的 `/playground/` 目录，不依赖访问者电脑上的开发服务器。
也可以通过演示上方的链接在独立窗口打开。

## 这个场景验证了什么

| 业务区域 | 所属应用 | 技术入口 | 可观察能力 |
| --- | --- | --- | --- |
| 全局导航、市场与期间筛选 | Host shell | Vite host | 宿主组合、跨应用 props 更新 |
| 优先订单处置队列 | Fulfillment | Vanilla + HTML Entry | HTML 模板、原生 `dialog`、事件清理 |
| 营收与履约信号 | Commerce intelligence | React 19 + HTML/ESM | 独立模块图、Ant Design Modal、Portal |
| 客户风险工作台 | Customer success | Vue 3 + HTML/ESM | Element Plus Dialog/Drawer、Teleport |
| 传统系统迁移台 | Legacy operations | Vue 2 + HTML/ESM | Element UI Dialog、`append-to-body`、渐进迁移 |

页面底部的 Runtime isolation 状态会显示已挂载应用数量。你也可以在浏览器开发者工具
中检查每个 `micro-app-host`：可视内容位于 ShadowRoot，旁边的隐藏 iframe 提供独立
JavaScript Realm。

## 部署到其他环境

构建完整站点（文档、宿主及四个微应用），并在本地验证与 GitHub Pages 相同的项目子路径：

```bash
DOCS_BASE=/micro-framework/ bun run docs:build:site
bun run test:pages
```

输出目录为 `packages/docs/.vitepress/dist`，可直接交给静态站点服务。生产微应用通过 HTML 入口加载
构建后的 ESM 和样式，JavaScript 仍在各自 iframe Realm 执行。宿主、启动页、共享模块及应用资源都使用部署子路径。
本地开发仍可使用直接 ESM 源码入口。

如需独立部署演示，文档构建可以通过 `VITE_MICRO_FRAME_DEMO_URL` 指向其他示例宿主：

```bash
VITE_MICRO_FRAME_DEMO_URL=https://demo.example.com/ bun run docs:build
```

完整站点构建默认嵌入同站演示；配置该变量时使用指定地址。仅运行 `docs:build` 且未配置演示地址时，
仍显示本地运行说明。本地开发文档使用 `127.0.0.1:5173`。
