# 开发验收记录

当前版本：2.1.0（MarkWeave），2026-11-03。原始 `dev.md` 与 0.2.0 评估证据保持原样。改动和当前结论见 [评估响应](REVIEW_RESPONSE.md)。

- `npm run check`：ESLint、TypeScript、76 项核心/往返/扩展渲染/评估/结构/门禁回归与生产构建。
- `npm run test:ui`：26 项实际前端 bundle 与模型集成测试，覆盖来源写回、导航滚动跟随与标题对齐、Pin/Esc/焦点返回、工具栏 8 控件与隐藏恢复、Insert 键盘菜单、20 轮纯键盘流程、toast 不占布局、五种宽度及 100%/200% 布局、30k 标题、Mermaid/代码块操作菜单、专注模式、超大块降级、标题层级/全宽排版、表格含 Emoji 的原位编辑、HTML rendered contenteditable、复杂扩展块编辑器，以及引用链接/脚注/数学/Alerts/TOC/Wiki/注释/安全 HTML/远程图片扩展渲染。浏览器适配器不是 VS Code 宿主。
- `node scripts/test-host.mjs markweave-win32-x64-2.1.0.vsix`：隔离安装包宿主检查，包含原生 API、保存/另存为、Include、段落合并、备份、PDF、20 次剪贴板回读、20 次 PNG、按文档保存的导航/工具栏偏好和真实 Webview。
- `npm run test:review` 仍保留 0.3 历史 CDP 工具链；2.1.0 的当前自动化证据使用 `test:host`，并按 `release:gate` 的 response-2.1.0 目录要求收集。
- `npm run release:gate`：完整证据必须位于 `review-artifacts/response-2.1.0/acceptance.json`，匹配版本、VSIX 和实际运行文件哈希；缺证据、样本不足、超过门槛或人工验收不足均失败。单测验证人为超过门槛会失败。

CI 在 Windows 上检查开发宿主和安装包宿主；标签发布额外执行稳定发布门禁。当前交付为开发验证版，尚未完成所有稳定发布条件。
