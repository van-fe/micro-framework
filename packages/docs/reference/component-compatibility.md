# 第三方组件兼容矩阵

以下条目都由顶层 Playwright 应用测试在 Chromium、Firefox、WebKit 中执行。前三项 UI 组件库另由
Vitest Browser Mode + WebdriverIO 在真实 macOS Safari 中以实际示例入口执行 3/3。组件运行在独立 iframe
Realm，展示节点和样式位于当前应用 ShadowRoot；不是在宿主页面直接渲染后做静态选择器检查。

| 类别 | 技术栈与版本 | 已验证行为 | 三引擎 |
| --- | --- | --- | --- |
| React UI | React 19.2.8 + Ant Design 6.6.2 | Portal、Modal、Drawer、Tooltip、Dropdown/Menu、显式容器、锚定/视口定位、真实点击、进出场 motion、宿主交互恢复 | 通过 |
| Vue 3 UI | Vue 3.5.42 + Element Plus 2.14.5 | Teleport、Dialog、Drawer、Tooltip、Dropdown/Menu、显式容器、锚定/视口定位、真实点击、进出场 motion | 通过 |
| Vue 2 UI | Vue 2.7.16 + Element UI 2.15.14 | append-to-body、Dialog、Tooltip、Dropdown/Menu、Vue 单例运行时、ShadowRoot/旧 Popper 滚动定位、真实点击与离场清理 | 通过 |
| 富文本 | Quill 2.0.3 | Snow toolbar、contenteditable、真实键盘输入、全选与加粗、text-change | 通过 |
| 代码编辑器 | Monaco Editor 0.56.0 | JSON 真实键盘编辑、语言 Worker 诊断、自动 layout、Shadow DOM 样式与销毁 | 通过 |
| 图表 | Apache ECharts 6.1.0 | SVG renderer、坐标轴/柱图、更新、resize、Shadow DOM 所有权 | 通过 |
| 地图 | Leaflet 1.9.4 | SVG vector、Popup、Zoom control、无动画 pan、Shadow DOM 所有权 | 通过 |
| WebGL 地图 | MapLibre GL 6.6.0 | Vite 自包含跨源 Worker、本地 GeoJSON、WebGL Canvas、jumpTo 与销毁 | 通过 |
| 3D/WebGL | Three.js 0.185.1 | 场景图、标准材质 shader、像素读取、旋转重渲染、WebGL context 主动释放 | 通过 |
| 浏览器原语 | Module Worker + WebGL 1 + 多语言输入 | 跨源 Worker 包装、structured clone、像素读取、中文真实输入、原生 CompositionEvent、清理 | 通过 |

组合矩阵应用位于 `examples/component-matrix-app`，由 `tests/e2e/component-matrix.spec.ts` 验证。测试还要求：

- 宿主 `document.querySelector()` 不能越过 ShadowRoot 找到 Quill、Monaco、MapLibre 或 Three.js Canvas；
- iframe Document Bridge 可以查询当前应用编辑器；
- Quill、Monaco、ECharts、Leaflet、MapLibre、Three.js 的节点都由当前应用 ShadowRoot 持有；
- dispose 后 iframe 与 `micro-app-host` 都归零。

MapLibre 6 在 Vite 中显式使用 `maplibre-gl-worker.mjs?worker&url` 并基于 `import.meta.url` 转为微应用
Origin 的绝对 URL；这既保证生产 Worker 是自包含 chunk，也让 Runtime 的跨源 Worker 桥接与回收合同生效。

## 尚未覆盖的组合

矩阵证明的是表中版本和行为，不代表整个生态自动兼容。以下仍需按真实业务优先级扩展：

- Quill 第三方 mention/table/image 插件、IME 长文本和协同编辑；
- Monaco TypeScript/HTML/CSS Worker、LSP、diff editor、超大文件和第三方扩展；
- ECharts Canvas/WebGL 扩展、大数据和高频 resize；基础 WebGL context/clear/readPixels 已验证；
- Leaflet raster tile、外部瓦片 CORS、marker 图片资源和第三方插件；
- MapLibre 外部矢量瓦片/字体/图片、第三方 control，以及 CodeMirror 等其他复杂全局资源库；
- 真实 macOS Safari 的 Quill/Monaco/地图/WebGL 完整组合矩阵、iOS Safari、物理设备触控、软键盘、OS 级
  IME 候选窗和移动端内存压力；React/Vue 3/Vue 2 组件库应用级 Safari 场景已覆盖。

新增组件库时，不应仅加入示例页面；必须把初始化、至少一次真实交互、跨 ShadowRoot 逃逸检查和销毁清理
一起加入三引擎 Playwright E2E；若依赖 Safari 特有事件、布局或系统 API，还需加入真实 Safari 应用级门禁。
