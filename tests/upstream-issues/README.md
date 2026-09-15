# 上游问题回归台账

本批新增 **20 条**（qiankun、wujie 各 10），累计 **140 条**。本批 **2 条本地缺陷修复并通过、8 条所列范围回归通过、10 条部分覆盖**；部分覆盖不计作原场景完全兼容。

本批20条均为无标签补充故障报告。精确bug标签完整枚举为 qiankun 40（open 7、closed 33）、wujie 10（open 2、closed 8），均已入旧台账；新增精确标签0，各仓库缺口10。近期补充搜索各取100条（总数2091、835），明确非全量，不用标题冒充标签。

本批记录：[执行证据](runs/2026-09-09-upstream-05.json)、[逐条场景与限制](cases.md)、[完成核对](assessments/2026-09-09-batch-04-completion.json)、[来源审计](collections/2026-09-09-batch-04/source-audit.json)。旧120条及6个历史来源对象保持不变。

最终单测 174、三引擎 Browser Mode 483、全量 E2E 423、生产/SSR/离线 18 均通过，无跳过与重试通过项；架构、类型、构建通过。真实 Safari 未运行。Runtime gzip **110138 字节**，超过既定50000字节预算，发布体积门禁仍失败。

修复宿主视口resize未转发导致真实组件浮层错位，以及WebKit保活后第二代相同样式未激活；另修复document.baseURI逻辑基址及由此暴露的Worker源站判定问题。旧W1049计数测试增加独立请求路径，防止三引擎共享HTTP日志串扰，未放宽单次请求断言。所有失败和中断报告均保留。

CSS超时可清理Runtime资源，但原生挂起CSS传输未取消，原URL及更换revision的恢复尝试仍有引擎失败，因此保留部分覆盖。原Umi插件、未提供原工程、真实Safari/企业微信、32位Windows堆内存等差异逐条列明。WebKit通过不代表真实Safari已验证。

## 上一批（2026-09-08-batch-03）

本批新增 **40 条**（qiankun、wujie 各 20），累计 **120 条**。本批 **6 条本地缺陷修复并通过、23 条所列范围回归通过、11 条部分覆盖**。部分覆盖不计作原场景完全兼容。

本批40条全部为无标签补充故障报告。GitHub REST核验精确bug总数：qiankun 40、wujie 10，均已在旧台账；查询无截断，按open/closed复核。各仓库新增精确bug标签缺口20，未用标题或补充报告冒充bug标签。相近报告保留独立身份并关联，不声明40种独立缺陷。

本批执行记录：[ 2026-09-08-upstream-04 ](runs/2026-09-08-upstream-04.json)，[逐条场景和限制](cases.md)，[完成核对](assessments/2026-09-08-batch-03-completion.json)。旧80条来源、状态与测试绑定保持不变，导入前快照在collections中。

最终验证：单测 174、三引擎 Browser Mode 462、全量 E2E 360、生产/SSR/离线 15 均通过；真实Safari未运行。类型、构建、架构检查通过。Runtime gzip为110025字节，超过50000字节既定预算，发布体积门禁仍失败，未修改阈值。

本批修复相对动态脚本地址、HTML import map、iframe原生Custom Elements延迟升级、Vite dev样式资源基址；另补显式HTML头部元数据保留。真实Vite生产/dev、Vue scoped src/@import/CSS modules、React useEffect、Webpack DLL/Module Federation、Vue Router/i18n、Axios均使用锁定依赖验证。采集清单保留相近报告，不用修复数量冒充独立缺陷数量。

限制详见各条：未知缓存现场/原工程、宿主已求值函数的原生Realm、原生Location与显式路由端口、自定义fetch迁移、隐藏应用通知、隐式favicon等仍有条件差异。HTML import map当前拒绝不同nonce合并；metadata可查询不等于宿主PWA/CSP/refresh生效。

历史：[上一批](runs/2026-09-08-upstream-03.json)、[首批](runs/2026-09-08-upstream-02.json)。

## 收集与去重

从仓库根目录执行，不修改 GitHub：

```sh
bun scripts/upstream-issues.mjs check
bun scripts/upstream-issues.mjs list
bun scripts/upstream-issues.mjs import /private/tmp/new-issues.json
bun scripts/upstream-issues.mjs --catalog /private/tmp/catalog-copy.json check
node scripts/verify-upstream-issues.mjs
```

导入接受条目数组或 `{ "issues": [...] }`，新增条目遵循现有字段结构，使用 `status: collected`、
`tests: []` 和空 `resolution`。先验证全部输入与合并结果，再原子写入；已存在的身份一律跳过，
不覆盖处理状态、分析和证据。全为重复时不覆写文件，输入自身重复或任何条目无效时整体拒绝。
`verify-upstream-issues.mjs` 在临时副本验证大小写去重、混合导入、历史来源保留及失败原子性，
并检查正式台账的字节和修改时间未变；它不会向正式台账写入测试条目。

`check` 只校验结构、状态和证据文件路径，不执行测试，也不能证明测试通过。测试映射保存准确标题、
仓库内相对路径和 `runId`；当前完成状态只能来自实际执行证据。

## 状态定义

| 状态 | 准确含义 |
| --- | --- |
| `collected` | 已收集，尚未分类 |
| `test-not-written` | 场景明确，但尚未编写对应测试，也没有该场景执行结果 |
| `partial-coverage` | 专用简化测试通过，明确缺少原始触发条件的覆盖 |
| `missing-reproduction-details` | 缺少已逐项列出的版本、配置或代码，因此尚未构造对应测试 |
| `contract-not-assessed` | 尚未核对上游 API 在本项目中的对应契约，尚未测试 |
| `verification-in-progress` | 已编写针对性测试并正在执行或修复；尚未完成该条所需验证，不能视为通过或无法复现 |
| `regression-passed` | 关联测试已执行通过，结论只适用于 `resolution` 所列条件 |
| `fixed` | 明示的本地缺陷已有失败证据，修复后关联测试通过 |
| `unsupported` | 当前契约明确拒绝所列行为，不计作兼容成功 |
| `partially-unsupported` | 必须逐场景分别列出明确不支持与尚未测试的状态 |
| `out-of-scope` | 既有产品决策排除该环境或场景，须写明依据 |

旧的 `needs-reproduction` 已停用，工具会拒绝它。未写测试不表示“已经尝试但无法复现”。
所有未完成状态必须给出具体 `statusReason` 和 `nextAction`；缺资料还必须列出 `missingDetails`。
`scenario`、`expectedBehavior`、`testIdea` 是采集时的描述与验证目标，实际结果以 `tests` 和 `resolution` 为准。

`document.write` 已增加默认兼容；其流式写入范围和原生解析器差异记录在 W49 与正式 Document Bridge 文档。
不能以曾经的拒绝测试作为兼容成功证据。W116 的 CSSOM 保活探针通过，额外发现的 hidden 显示缺陷
保留在 `relatedFixes`，仍不冒充“本地复现原 twind 规则丢失”。
