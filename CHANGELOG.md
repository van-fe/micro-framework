# Changelog

当前版本为 **0.0.1**。后续版本净变化统一维护在 [UPDATES.md](UPDATES.md)；以下保留此前未发布阶段的历史记录。

## Unreleased

- 补全 hooks、HTML/manifest/脚本和跨域加载取消；有界资源清理及按实例的异步 Realm 错误转发。
- 新增服务端灰度策略、可选遥测和同名多实例 Inspector，提供 Chromium 本地 DevTools 扩展。
- 新增 Angular AOT adapter、Webpack 原生 ESM/宿主 bootstrap 插件和三引擎集成门禁。
- 修正 Vite sourcemap 模式下 manifest SRI 与最终文件字节不一致的问题，重新计算最终签名。

- 修复卸载钩子异常导致销毁清理中断；并发销毁复用操作，所有实例清理后统一返回错误。
- 异步 props 增加加载超时与挂载/预热取消；取消后不继续备用入口或后续生命周期回调。
- 更新异常/超时统一上报并硬重置，允许重新挂载；销毁等待中的更新不会卡住。
- CLI 增加固定框架版本和 scoped registry 参数；消费者验收不再改写生成的 package.json。

- CLI 四类模板使用正式 Runtime 独立预览；修复 React 类型依赖和 Vue 2 props 类型推导。
- 修复安装后的 CLI 经 `.bin` 符号链接调用时不执行命令的问题；验收直接使用已安装 CLI 创建应用。
- React/Vue 3 适配器提供 Hydration，增加生产 SSR 节点复用、更新、交互与清理验收。
- 补齐 DOM/Entry 包 sourcemap、公开类型的 contracts 依赖；新增完整 Runtime 体积与产物门禁。
- 新增私有 tarball 准备、独立消费者验收与 GitHub Actions 配置。
- 分离 DOM Surface 入口、迁移脚本扫描、应用上下文和 LRU 淘汰职责。
- 修正 Safari 测试助手在点击菜单项前先点击外部区域、意外关闭菜单的操作。

尚未发布正式版本。许可证、包仓库和访问级别待项目所有者确定。
