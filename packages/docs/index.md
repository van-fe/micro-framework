---
layout: home

hero:
  name: Micro Framework
  text: 真实 Realm 隔离的现代微前端运行时
  tagline: 每个实例在独立 iframe Realm 中执行 JavaScript，并将 DOM 与 CSS 渲染到应用自己的 ShadowRoot。保留熟悉的开发方式，同时阻止可信内部应用的意外全局污染。
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 理解核心架构
      link: /architecture/overview
    - theme: alt
      text: 打开交互演示
      link: /demo/
    - theme: alt
      text: 查看实现状态
      link: /reference/implementation-status

features:
  - title: 真实 iframe Realm
    details: 微应用的 window、globalThis、原型和 ESM 模块图都属于自己的浏览器 Realm，不依赖宿主全局 Proxy。
  - title: Shadow DOM 承载
    details: 可视 DOM 与样式归入每实例 ShadowRoot；弹层默认覆盖宿主视口，显式容器则控制局部定位。
  - title: 渐进迁移
    details: 当全局污染、资源残留和多套隔离语义已成为治理成本时，可从兼容 API 灰度迁入真实 Realm 与固定 Shadow DOM，而不是一次性重写业务。
  - title: 可取消生命周期
    details: 加载、挂载、更新、卸载和销毁具备显式状态、超时、AbortSignal、latest-wins 与幂等清理。
  - title: 多框架接入
    details: 提供 React、Vue 3、Vue 2 和 Vanilla 适配器，覆盖 Ant Design、Element Plus、Element UI、Quill、Monaco、ECharts、Leaflet、MapLibre、Three.js、Portal 与 Teleport。
  - title: 三引擎门禁
    details: Vitest Browser Mode 与 Playwright E2E 在 Chromium、Firefox、WebKit 中覆盖包级 DOM/Realm 合同和完整应用链路。
---

## 设计边界

Micro Framework 面向**可信内部应用的意外污染隔离**。同源 iframe 仍能主动访问 `parent`、`top` 或宿主节点，因此它不是执行未知恶意代码的安全容器。需要运行不可信代码时，应采用不同 Origin 的可见 sandbox iframe 与序列化消息协议。

## 当前里程碑

- Bun monorepo 与 Vite 8.2.2 工具链；
- 原生 ESM Entry 与 HTML Entry；
- React + Ant Design、Vue 3 + Element Plus、Vue 2 + Element UI、Vanilla、兼容迁移示例；
- Micro Framework 选型优势、与 qiankun/wujie 的能力性能对比、迁移指南与配置迁移规划器；
- 每实例 Import Map、共享依赖 SemVer 协商与 iframe `modulepreload`；
- 应用命名空间 IndexedDB 持久化与 structured-clone 语义；
- 直接 IndexedDB、BroadcastChannel、SharedWorker、Web Locks 命名空间与可选 Web Storage 兼容桥；
- 同应用跨标签页 BroadcastChannel 与跨应用隔离；
- 宿主统一 Service Worker 离线缓存、应用版本原子切换与失败回滚；
- 跨域可见 sandbox iframe 强隔离与结构化生命周期协议；
- 服务端 DSD 流式输出、节点复用 Hydration 与 CSR 回退；
- CSP-safe 服务端应用注册、共享目录 bootstrap 与动态 Import Map；
- 发布前 CSP/CORS/MIME/SRI 资源图扫描、Vite/Nginx CORS 配置计划与浏览器策略报告汇总；
- 只读 Runtime DevTools Inspector、PerformanceResourceTiming 网络瀑布、发现 Hook 与隔离页内面板；
- Quill、Monaco、ECharts、Leaflet、MapLibre、Three.js 三引擎真实交互兼容矩阵；
- HTML Entry 三引擎 3×30 首次/重复挂载 P50/P95、三架构同工作负载比较，以及三会话真实组件内存门禁；
- 最新优化验收为单测 192/192、三引擎 Browser Mode 501/501、E2E 423/423、benchmark 43 通过 / 2 按设计跳过；
- 历史三引擎各 60 分钟 soak 已通过，但本轮优化未重跑真实 Safari 与长时 soak；完整 Runtime gzip 仍超过发布预算。

[查看完整实现状态 →](/reference/implementation-status)
