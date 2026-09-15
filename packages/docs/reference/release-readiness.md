# 发布与外部验收

包命名空间统一为 `@micro-framework`，例如 `@micro-framework/runtime`。
支持内部 tarball 验证、GitHub Pages 文档部署和 npm 发布。文档已通过 GitHub Actions 部署成功；npm 包尚未正式发布，仍需通过下述发布门禁。

## 自动部署文档

在仓库 Settings → Pages → Build and deployment 中将 Source 设为 **GitHub Actions**。
`docs.yml` 在默认分支每次 push 后构建并部署，也支持在默认分支手动运行；其他分支不覆盖线上文档。
VitePress 读取 Pages 返回的 base path，兼容项目子路径和自定义域名，本地开发仍使用 `/`。
在线文档：[中文版](https://van-fe.github.io/micro-framework/) · [English](https://van-fe.github.io/micro-framework/en/)。两种语言支持同篇切换、独立搜索及跟随语言的在线演示。当前公开仓库使用 GitHub Actions 作为 Pages 发布来源，后续推送到 `main` 自动更新。

工作流运行 `docs:build:site`，将宿主和 Vanilla、React、Vue 3、Vue 2 微应用一起发布到站点的 `/playground/` 目录，
文档默认直接嵌入它。发布前在 Chromium、Firefox、WebKit 中验证独立窗口和文档内嵌两种形式，覆盖四应用加载、
语言/市场更新、弹层、Realm/Shadow DOM 隔离和销毁；使用假接收端验证遥测零外发并阻止 Service Worker。
可设置仓库 Actions variable `MICRO_FRAME_DEMO_URL` 覆盖为其他已部署的 HTTPS 演示地址。
配置方式参见 [GitHub Pages 官方说明](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 发布到 npm

`npm.yml` 在 GitHub Release **published** 后发布所有框架库包，也支持手动选择现有 tag（默认 dry-run）。
仓库根目录、文档站和示例始终不发布。包为 public scoped packages，源 workspace 的 `private: true` 保留，
仅发布暂存区删除私有标记；日常 push 只部署文档，不会发布 npm。

1. 在 npm 中准备 `@micro-framework` scope 的发布权限；确定项目许可证并补充元数据及根 `LICENSE`。
2. 建立 GitHub `npm` environment。首次发布可将可用于 CI 发布的 granular token 保存为该环境的 `NPM_TOKEN` secret。
   已有包推荐逐包配置 npm Trusted Publisher：owner `van-fe`、repository `micro-framework`、workflow `npm.yml`、environment `npm`，允许 publish。
   配置后可移除 token，使用工作流的 OIDC 身份。Node 24 提供兼容的 npm CLI；详见 [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)。
3. 同步根和全部 workspace 的版本并用 Bun 更新锁文件，提交后创建匹配的 tag，例如当前版本 `v0.0.1`。
4. 先手动运行 **Publish npm packages**，填写该 tag，保持 `dry_run` 勾选；通过后发布对应 GitHub Release，或手动取消 dry-run。

版本 tag 必须严格等于根版本前加 `v`。稳定版本发布到 `latest`，含预发布标识的版本发布到 `next`。
流程执行冻结安装、架构/类型/单元/发布脚本测试，以及框架构建、产物和体积门禁；任何失败都会阻止上传和发布。
浏览器与完整应用验收由 `validate.yml` 执行，创建 Release 前还应确认该提交通过这些验收。
当前已知 Runtime 体积超预算，因此正式发布仍会被门禁阻止，不能把新增工作流当作发布就绪。

发布产物保存为 `npm-packages` artifact；`.artifacts/npm/manifest.json` 记录 SHA-256。
脚本先校验整批 tarball，再按依赖顺序发布；重试会跳过 npm 上内容完全一致的版本，遇到同版本内容不同则失败，
网络或权限错误不会当作包不存在。多包发布不具备事务性；部分失败应重跑原 job，保留相同源码与产物。

```bash
# 本地仅打包及 dry-run，不进行真实发布；仍执行体积门禁。
bun run release:prepare:npm
RELEASE_TAG=v0.0.1 npm_config_offline=true node scripts/publish-npm.mjs --dry-run
```

## 本地与 CI

```bash
bun install --frozen-lockfile
bun run verify
bun run benchmark
```

`verify` 顺序执行架构、类型、全 workspace 构建、产物/体积、Node 单元、三引擎浏览器合同、应用 E2E、
移动模拟、生产 SSR/离线测试，以及真实 tarball 安装后的四框架模板开发/生产页面测试。
测试移动代码与桌面代码共享 Runtime 声明，均进入严格类型检查。

GitHub Actions 的 `validate.yml` 在 push/PR 或手动触发时执行此门禁，并保留失败 trace、体积报告和 tarball。
`benchmark.yml` 手动或每周运行短基准和每引擎 60 分钟 soak。`safari.yml` 只允许手动在带
`micro-frame-safari` 标签的自托管 Mac 上执行，要求桌面解锁、Safari Remote Automation 已启用。
本轮未触发远端工作流；本地验证不能代替远端运行记录。

## 产物验收与体积

`bun run check:artifacts` 验证公开 exports、声明映射和可执行 JS sourcemap。Vite 对仅转发 import/export 的
入口可能不生成映射，因此只对确有执行逻辑的模块强制要求 JS map；判断使用 TypeScript AST。

体积报告写入 `.artifacts/bundle-size.json`，使用字节作为单位：

| 口径 | 上限 | 范围 |
| --- | ---: | --- |
| Runtime Core 单文件 gzip | 15,000 | 保留工作区外部依赖的核心编排包 |
| 默认 Runtime ESM gzip | 50,000 | 从公共 Runtime 入口打包所有可达依赖；不含业务框架适配器、业务 React/Vue 和独立 bootstrap |
| Realm bootstrap gzip | 5,000 | 原生 iframe 模块启动入口 |

后两个值是本次建立的回归预算，不是对外性能承诺。变更预算应附带测量结果与原因，不能仅为消除失败而上调。

当前默认 Runtime 不包含 `@micro-framework/document-write` 或 `parse5`，产物检查通过实际模块图防止它们
重新进入默认依赖。拆分后 Runtime Core 为 9,144 字节、默认 Runtime 为 60,383 字节、bootstrap 为 304 字节。
默认 Runtime 相对拆分前的 112,016 字节减少约 46%，仍超过现有 50,000 字节上限，`check:artifacts` 因此失败。
可选 `document-write` 包单独记录为 `documentWriteGzipBytes`，当前为 53,243 字节；它不计入默认 Runtime，
但显式启用时仍会下载，其单独 gzip 大小不能与其他包简单相加来推导整体压缩大小。
下文历史批次的通过记录不适用于当前产物。预算尚未调整，行为测试通过不代表发布门禁全部通过。

```bash
bun run release:prepare
bun run test:templates
```

`release:prepare` 构建并检查产物，将 30 个库包（排除文档站）打成内部 tarball。它保留私有标记，转换暂存
manifest 的 `workspace:*` 为同批版本，包含 dist 与用于声明映射的源码；不修改源包版本、不执行发布。
`.artifacts/release/manifest.json` 记录每个包的 SHA-256。`test:templates` 先在独立临时目录安装 CLI tarball，
通过实际 `.bin/micro-frame` 命令指定固定版本及临时本地 registry 创建四种模板，原样安装依赖、执行 typecheck/build，最后在
三引擎验证 dev 与 production，共 24 个场景。这也覆盖 Node shebang 和包管理器符号链接下的 CLI 入口执行。
仅安装测试用 CLI 工具本身使用 tarball overrides；四种生成应用不改写 manifest、不注入 overrides，
由临时 registry 提供同批 tarball，并校验安装前后的 package.json 完全一致。

npm 目标为 public `@micro-framework/*` 包，版本以根 `package.json` 的 `0.0.1` 为准。
正式发布前仍需确定许可证与版本兼容政策，并按上文配置发布身份；本地准备不执行真实发布。

## 外部验收表

2026-09-08 上游问题补齐批次完成冻结安装、架构、类型、全 workspace 构建、Node 153/153、
三引擎包级 321/321 和三引擎应用 E2E 222/222。逐条问题、原始失败和最终报告保存在仓库
`tests/upstream-issues/runs/2026-09-08-upstream-02.json`。本批未重新执行真实 Safari、移动模拟、
生产 SSR/离线、模板消费者、集成与基准门禁；产物体积检查失败，不能称为完整 `verify` 通过。

2026-09-07 六项能力补齐后，`bun run verify` 串行完成：146 条单元、144 条三引擎包级、123 条应用 E2E、
4 条移动模拟、12 条生产 SSR/离线、24 条模板页面、6 条 Angular/Vite/Webpack 集成，共 459 条全部通过。
新增覆盖完整加载取消/超时、有界资源清理、Realm 异步错误转发、确定性服务端灰度、遥测、同名实例和
Angular AOT 原生 ESM 构建。冻结锁文件安装、严格类型、全量构建、架构及产物/体积检查均通过。

真实 macOS Safari 于 2026-09-08 解锁后复核通过：48 条包级合同、3 条组件场景，共 51 条全部通过。
日志为 `.artifacts/completion-safari-20260908.log`。2026-09-07 因锁屏导致的失败记录保留于
`.artifacts/completion-safari-verification.log`；解锁后无需修改代码即可通过。新增异常 E2E 的执行环境为 Chromium、Firefox、
WebKit，尚未单独移植到真实 Safari runner。该历史批次完整 Runtime gzip 为 44,212 字节，当时低于 50,000 字节门限。
该历史批次完整门禁日志为 `.artifacts/completion-verification.log`。

`bun run test:extension` 已在 Chromium 真实加载未打包扩展，并通过 inspectedWindow 读取、同名实例展示、
文本安全渲染与导航恢复检查；证据为 `.artifacts/completion-extension.log`、`.artifacts/devtools-extension.png`。
CI 已配置相同扩展门禁，但本轮没有触发远端 CI，也未上架扩展商店。

短基准 12 条仍引用本日上一轮结果；60 分钟/引擎 soak 引用 2026-09-02 历史结果，本轮未重跑。
正式验收必须串行运行，不能一边执行 E2E 一边重建框架。架构仍有两条已复核的文件行数提示，理由见本页“职责复核”。

每项报告应记录源码版本或文件快照校验值、设备/OS/浏览器版本、应用及组件版本、配置、步骤、结果、
trace/录像与失败问题链接。没有这些证据时状态保持“未验证”。

| 验收项 | 环境与操作 | 通过条件 | 当前状态 |
| --- | --- | --- | --- |
| iOS Safari | 至少一台真实 iPhone，软键盘、旋转、后台恢复、Portal/Teleport、页面滚动 | 交互可达、浮层归属正确、恢复可用、destroy 无 DOM/iframe 残留 | 未验证 |
| Android | 真实 Android Chrome，触控、键盘、后台恢复、内存压力 | 同上，记录设备压力与恢复行为 | 未验证 |
| 系统能力 | 文件选择、摄像头、剪贴板、全屏等；分别授权、拒绝、取消 | 正确结果或稳定错误，关闭/销毁后释放资源 | 需逐能力实机报告 |
| 真实 Safari 复杂组件 | Quill 插件、Monaco 语言 Worker、地图外部瓦片、WebGL | 初始化、真实交互、URL/CORS、节点归属、最终清理均通过 | 基础 UI 有历史证据，复杂组合待验证 |
| 独立 CDN 部署 | 宿主/微应用不同 Origin，真实 CSP/CORS/MIME/SRI、版本回退 | 诊断通过、错误可定位、旧资源与新版本行为可预测 | 未验证 |
| 弱网和离线 | 冷缓存、限速/丢包、源站失败与恢复 | 加载可取消、重试/回退有效、不影响其他应用 | 本地合同已有，真实网络待验证 |
| 长期业务试点 | 至少一个真实业务应用，连续 72 小时采集内存/错误/加载与销毁 | 无持续增长的残留趋势、无跨应用污染；性能按试点前约定阈值判定 | 未验证 |

外部组件按业务使用优先级逐项接入，详细未覆盖组合见[组件矩阵](/reference/component-compatibility)。
Angular AOT 与 Webpack 原生 ESM 现有基础适配；WebView/Electron、浏览器商店签名/上架、RSC/Suspense 协调仍是独立范围。

## 职责复核

DOM Surface 的公共 index 已改为纯导出；创建与 Hydration 逻辑由具名模块负责。迁移扫描的诊断聚合与
脚本 AST 检查已分开。Runtime 抽出应用上下文构建、统一 LRU 淘汰和可取消/超时等待，保留 AppController 内同一个生命周期
状态机，以及 MicroRuntime 内同一个注册/路由编排者。两者仍超过架构脚本的行数提示阈值；本次评估选择
保留这些内聚状态转换，避免仅为缩短文件而暴露可变状态或创建第二套 Runtime。
