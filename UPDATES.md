# 版本更新

记录各版本最终保留的新增能力、修复和行为变化；同一版本内合并更新，不按任务重复追加。当前版本：**0.0.1**。

## 0.0.1 — 2026-09-09

### 初始能力

- 建立 Bun workspace、Vite 构建及 TypeScript 严格类型工程，提供统一 Runtime Core、原生 API 和兼容入口。
- 每个微应用使用独立 iframe Realm 执行 JavaScript，并在专属 ShadowRoot 渲染 DOM/CSS；支持 HTML 与 ESM 入口、生命周期、取消与超时、预加载、保活及资源销毁。
- 提供 React、Vue 3、Vue 2、Angular 和 Vanilla 适配及示例，补充组件浮层、事件、动画、焦点、原生对象与资源解析等跨文档语义。
- 提供可选跨域强隔离、SSR/流式 Hydration、离线缓存、服务端应用注册与共享依赖，以及 CLI、迁移工具、部署诊断和 DevTools。

### 兼容性补足

- 补齐动态脚本与样式的插入、资源基址、HTML import map 和 Document 查询；部分 document.write 生命周期行为由独立可选包提供。
- 补齐字体、rem、根样式与浮层坐标隔离，以及原生 Custom Elements 延迟升级和跨文档样式表归属。
- 修复宿主视口 resize 未转发导致的组件浮层错位，以及 WebKit 保活后重建同源样式时未重新激活的问题。
- 统一应用 document.baseURI 与入口资源基址；Worker 的相对路径解析使用资源基址，源站判断使用实际执行源站。
- 加固并发挂载/卸载、加载失败恢复、事件及应用资源清理；HTML 入口发现跳过第三方库循环 default 和异常 getter，并按真实生命周期对象去重。建立上游问题去重台账与真实浏览器回归证据。
- Visual Bridge 为宿主 `matchMedia`、`ResizeObserver` 与 `IntersectionObserver` 建立逐应用资源所有权；显式移除、once/AbortSignal、重复断开、销毁后调用和多实例隔离保持原生语义，应用销毁会阻止宿主继续持有或回调已失效 Realm。
- Runtime、Document Bridge 与 Visual Bridge 的销毁链在任一步失败时仍会尝试全部后续清理、清空应用引用并聚合保留错误；重复 dispose/destroy 安全，加载取消和 fallback 恢复不会遗留 Surface、Realm 或宿主观察器。
- HTML Entry 在同一 Runtime 内复用有界、限时且不含 DOM/Realm 的解析结果；重复挂载不再重复抓取和解析 HTML，仍在每个独立 iframe Realm 原生执行脚本。缓存按入口版本、基址、凭据、完整性与 manifest 等语义隔离，失败可重试，并可按 Runtime 禁用或调节容量。
- HTML 解析缓存现在同时遵守响应新鲜度：`no-store`、`no-cache` 或无明确新鲜度的响应不写入，有效 `max-age`/`Expires` 受 Runtime TTL 上限约束，保证同 URL 部署更新不会被旧解析结果覆盖。
- HTML Entry 子树准备在 Custom Elements 升级与 DOM 跟踪之间复用同一次后代枚举，并避免对已分别准备的 host/head/body 重叠扫描；动态样式、同步 CSSOM、字体/rem、SVG、嵌套 ShadowRoot 和弹层语义保持不变。
- React 适配器对 root 创建期间写入宿主 ownerDocument 的委托监听建立生命周期所有权，正常卸载和 root 创建失败都会释放；Document Bridge 同样兜底清除应用注册在 Realm Document 与应用 ShadowRoot 的监听，避免回调 Realm 线性保留已分离 iframe Document。
- SVG 样式使用对应原生访问器；保持 WebKit 重建应用的样式激活语义，保留未变选择器的 CSSOM 序列化并缓存框架生成样式，空样式探针不再触发同步全量样式扫描；动态 innerHTML/innerText 样式与 CSSOM-only 样式移除仍同步生效。

- 全屏但不接收鼠标事件的装饰层不会抬高整个应用并遮挡宿主导航；具有可交互后代的浮层继续保留全局堆叠能力。

### 工程流程

- 文档中的项目名称统一为 Micro Framework，同步中英文 README、站点标题与导航、迁移/架构/参考文档及项目版权署名。
- 本地 Git 从当前源码重新初始化为 main 分支，以单个初始提交建立新历史；使用本仓库作者配置，避免继承全局工作邮箱。
- 项目采用 MIT 许可证，根项目及工作区包统一声明 `license: "MIT"`；中英文 README 提供许可链接，公开 npm 与内部 tarball 均包含完整 LICENSE。
- 根 README 默认提供英文说明，新增 `README.zh-CN.md` 中文版并提供双向语言切换及在线/仓库内文档链接；两版同步可选写入用法、最新验证证据与体积限制。
- `document.write` 流式兼容及 `parse5` 拆入独立 `@micro-framework/document-write` 包，默认 Runtime 不依赖该包；宿主须显式传入安装器。未启用时实际调用 write/writeln/open/close 会被阻止并输出去重的安装指引，宿主与独立 Document 保留原生行为。文档明确默认行为、启用步骤、调用检测范围及原有兼容边界。
- npm 命名空间统一为 `@micro-framework`，同步工作区依赖、源码导入、构建 external、CLI 模板、架构检查和文档。
- 公开仓库通过 GitHub Actions 构建并部署文档到 `https://van-fe.github.io/micro-framework/`，默认分支每次推送自动更新。完整站点同时构建宿主及 Vanilla、React、Vue 3、Vue 2 演示到 `/playground/`，文档默认直接嵌入；生产 HTML/ESM、样式、共享模块和 Realm 启动资源均使用部署子路径。内嵌页采用原生响应式 iframe 视口，支持内部滚动和四框架弹层；保留独立演示地址覆盖。
- 增加 GitHub Release/手动 npm 发布工作流：版本一致性、产物哈希与依赖顺序检查，public 暂存打包、dry-run、OIDC 或 token 认证、稳定版/预发布 dist-tag，以及相同产物的重试去重；保留现有体积门禁，尚未执行远端发布。

- 每次产生文件变更的任务完成前，更新本文件的当前版本净变化，并以 `type(scope): message` 格式进行本地 Git 提交。
- 根项目及工作区版本统一为 `0.0.1`，建立当前项目的 Git 基线。
- 模板消费者验收读取根项目版本，并拒绝与当前版本不一致的旧打包产物。
- 启动可跨对话持续执行的框架优化目标；已冻结三浏览器 HTML Entry 首次/重复挂载与保活性能基线、现有 Realm 销毁门槛和后续组件内存采样条件。基准浏览器仅允许本地测试源，并在打开应用前以假接收端验证 fetch、XHR、Beacon、iframe、Worker 和 Service Worker 均不会产生 Sentry 外发。
- 增加 React + Ant Design、Vue 3 + Element Plus、Vue 2 + Element UI、Vanilla 的本地 production HTML Entry 回归矩阵；三次独立的预热 10 + 测量 100 内存会话均保持 Document/宿主监听稳定、应用资源归零，堆增长约 0.20～0.23 MiB，且覆盖弹层、快速切换和异常卸载。
- Browser Mode、E2E、移动端、生产、模板与集成测试统一在首次应用导航前启用 Sentry 零外发保护：禁用 Service Worker，通过本地假接收端验证 fetch、XHR、Beacon、iframe 和 Worker 全被阻止，并保存本地审计证据。
- 重写 qiankun 迁移与方案对比文档：把迁移理由从 API/能力清单收敛为真实 Realm、固定 Shadow DOM、资源所有权和统一 Runtime 治理的决策条件，并公开本轮 HTML Entry、样式扫描、真实组件内存的优化前后证据及不应迁移的边界。

### 验证范围与已知限制

- Pages 完整站点构建及三浏览器独立/内嵌演示 6/6 通过，覆盖四框架真实弹层、市场/语言切换、隔离和销毁；最终产物的 HTML/JS/CSS 不含开发服务器地址。冻结安装、全项目类型检查、架构检查、192 项单测与工作流 actionlint 通过。
- `@micro-framework/*` 命名与可选写入验证：41 个包、冻结安装、架构/类型检查和全量构建通过；单测 192/192、三引擎 Browser Mode 507/507、发布脚本测试 7/7 通过。E2E 全量 423 项通过，旧默认写入断言调整后另外 3 项三引擎定向复核通过；默认不加载可选包与显式启用的四框架写入均有覆盖。两个发布工作流已有 actionlint 证据，文档子路径构建及 30 个 tarball 的依赖核验/离线 dry-run 通过；GitHub Pages 文档部署已成功，npm 发布仍受体积门禁阻止。
- 其他矩阵保留既有验收证据：移动端 4/4，安全可执行的 production hydration/SSR/CSP 12/12，模板浏览器 24/24，Angular Vite/Webpack 集成 6/6。最终 benchmark 43 通过、2 按设计跳过，45 个 Context 均验证五类外发被阻止且 Service Worker 为 0。production offline-cache 用例需注册 Service Worker，与本地必须阻止 Service Worker 的约束冲突，因此未无保护执行；真实 Safari 和长时 soak 未执行。
- 上游台账累计 140 条；报告数量不代表独立缺陷数，部分覆盖的原始条件差异见 [上游台账](tests/upstream-issues/README.md)。
- 挂起 CSS 的原生传输取消与跨引擎恢复、部分原工程/历史版本及真实设备条件仍未完全验证。
- 默认 Runtime gzip 从 112016 字节降至 60383 字节，减少约 46%；可选 document-write 包单独为 53243 字节。默认依赖树和打包模块图禁止引入可选包/parse5，但默认 Runtime 仍超过既定 50000 字节预算，发布门禁尚未全部通过。
