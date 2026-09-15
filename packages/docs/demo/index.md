---
title: 履约运营台交互演示
description: 在文档中直接体验由 Vanilla、React 与 Vue 微应用共同组成的真实业务页面。
outline: false
sidebar: false
aside: false
---

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

const demoUrl = import.meta.env.VITE_MICRO_FRAME_DEMO_URL
  || (import.meta.env.DEV ? "http://127.0.0.1:5173/" : "");
const demoViewportWidth = 1180;
const demoFrame = ref<HTMLIFrameElement>();
const demoFrameShell = ref<HTMLElement>();
const frameHeight = ref(1180);
const frameScale = ref(1);
let demoOrigin = "";
let shellResizeObserver: ResizeObserver | undefined;

function receiveDemoSize(event: MessageEvent): void {
  if (
    event.origin !== demoOrigin
    || event.source !== demoFrame.value?.contentWindow
    || event.data?.type !== "micro-frame-demo:resize"
  ) return;

  const nextHeight = Number(event.data.height);
  if (!Number.isFinite(nextHeight)) return;
  frameHeight.value = Math.min(1800, Math.max(720, Math.ceil(nextHeight)));
}

onMounted(() => {
  if (!demoUrl) return;
  demoOrigin = new URL(demoUrl, window.location.href).origin;
  window.addEventListener("message", receiveDemoSize);
  shellResizeObserver = new ResizeObserver(([entry]) => {
    if (!entry) return;
    frameScale.value = Math.min(1, entry.contentRect.width / demoViewportWidth);
  });
  if (demoFrameShell.value) shellResizeObserver.observe(demoFrameShell.value);
});

onBeforeUnmount(() => {
  window.removeEventListener("message", receiveDemoSize);
  shellResizeObserver?.disconnect();
});
</script>

# 履约运营台交互演示

这个运营台模拟电商履约团队的真实日常：宿主负责全局导航、市场筛选与核心指标，
四个独立微应用分别承载订单处置、营收分析、现代客户风险和传统系统迁移。它们拥有各自的 iframe Realm、
模块图和 ShadowRoot，但组合后保持一致的产品体验。

宿主右上角提供中文/English 切换，并通过生命周期 update 将 locale 同步给全部微应用。
React 示例使用 Ant Design，Vue 3 使用 Element Plus，Vue 2 使用 Element UI。
四个微应用都提供了可操作弹窗。它们默认覆盖整个宿主视口，同时弹层 DOM 与样式仍归各自
ShadowRoot 所有；显式指定容器时才会按容器范围定位。这可以直接验证 React Portal、
Vue Teleport、Element UI `append-to-body` 与原生 `dialog` 的默认全局行为。

<p v-if="!demoUrl">在线演示尚未配置。可按下方说明在本地运行完整演示。</p>

<div v-if="demoUrl" class="demo-toolbar">
  <span><i></i> Live micro-frontend composition</span>
  <a :href="demoUrl" target="_blank" rel="noreferrer">在独立窗口打开 ↗</a>
</div>

<div v-if="demoUrl" ref="demoFrameShell" class="demo-frame-shell">
  <div
    class="demo-frame-stage"
    :style="{ height: Math.ceil(frameHeight * frameScale) + 'px' }"
  >
    <iframe
      ref="demoFrame"
      :src="demoUrl"
      :style="{
        height: frameHeight + 'px',
        transform: 'scale(' + frameScale + ')',
      }"
      title="Northstar fulfillment command center"
      loading="eager"
      allow="clipboard-read; clipboard-write"
    ></iframe>
  </div>
</div>

::: tip 本地运行
在仓库根目录执行 `bun run dev`，然后打开本页。默认情况下，文档运行于
`127.0.0.1:5178`，宿主和四个微应用运行于 `5173–5176` 与 `5179`。
:::

## 这个场景验证了什么

| 业务区域 | 所属应用 | 技术入口 | 可观察能力 |
| --- | --- | --- | --- |
| 全局导航、市场与期间筛选 | Host shell | Vite host | 宿主组合、跨应用 props 更新 |
| 优先订单处置队列 | Fulfillment | Vanilla + HTML Entry | HTML 模板、原生 `dialog`、事件清理 |
| 营收与履约信号 | Commerce intelligence | React 19 + ESM Entry | 独立模块图、Ant Design Modal、Portal |
| 客户风险工作台 | Customer success | Vue 3 + ESM Entry | Element Plus Dialog/Drawer、Teleport |
| 传统系统迁移台 | Legacy operations | Vue 2 + ESM Entry | Element UI Dialog、`append-to-body`、渐进迁移 |

页面底部的 Runtime isolation 状态会显示已挂载应用数量。你也可以在浏览器开发者工具
中检查每个 `micro-app-host`：可视内容位于 ShadowRoot，旁边的隐藏 iframe 提供独立
JavaScript Realm。

## 部署到其他环境

文档构建可以通过 `VITE_MICRO_FRAME_DEMO_URL` 指向已部署的示例宿主：

```bash
VITE_MICRO_FRAME_DEMO_URL=https://demo.example.com/ bun run docs:build
```

这样本地开发文档使用 `127.0.0.1:5173`，部署后的文档则嵌入对应环境的真实演示。
生产构建未配置演示地址时显示本地运行说明，不会尝试访问读者电脑上的服务。

<style>
.demo-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  z-index: 2;
  width: min(1196px, calc(100vw - 48px));
  margin: 26px 0 0 calc(50% - min(598px, calc(50vw - 24px)));
  padding: 10px 13px;
  border: 1px solid var(--vp-c-divider);
  border-bottom: 0;
  border-radius: 14px 14px 0 0;
  background: var(--vp-c-bg-soft);
  font-size: 13px;
}

.demo-toolbar span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--vp-c-text-2);
  font-weight: 650;
}

.demo-toolbar i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #72a943;
  box-shadow: 0 0 0 4px rgba(114, 169, 67, .12);
}

.demo-toolbar a {
  color: var(--vp-c-brand-1);
  font-weight: 650;
  text-decoration: none;
}

.demo-frame-shell {
  position: relative;
  z-index: 2;
  width: min(1196px, calc(100vw - 48px));
  margin: 0 0 28px calc(50% - min(598px, calc(50vw - 24px)));
  padding: 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 0 0 16px 16px;
  background: var(--vp-c-bg-soft);
  box-shadow: 0 22px 70px rgba(22, 33, 27, .09);
  overflow: hidden;
}

.demo-frame-stage {
  position: relative;
  width: 100%;
  overflow: hidden;
}

.demo-frame-stage iframe {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  width: 1180px;
  min-height: 720px;
  border: 0;
  border-radius: 10px;
  background: #f4f6f2;
  transform-origin: top left;
}

@media (max-width: 768px) {
  .demo-toolbar,
  .demo-frame-shell {
    width: calc(100vw - 24px);
  }

}
</style>
