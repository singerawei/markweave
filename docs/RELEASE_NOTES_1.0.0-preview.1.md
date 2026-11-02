# MarkdownUP 1.0.0 (Preview)

**本地优先的 VS Code Markdown 所见即所得编辑器。**

这是 1.0.0 的预览构建：功能与自动化验证完成，稳定发布门禁仍需补齐人工/长周期性能证据。

## 本版亮点

### Markdown 兼容性

- GFM 表格、任务列表、删除线、尖括号与裸 URL 自动链接。
- 跨块引用式链接；脚注；GitHub Alerts / Obsidian Callouts；Admonitions。
- KaTeX MathML 行内/块级数学；定义列表；`[TOC]`；缩写。
- `==高亮==`、下标 `H~2~O`、上标 `x^2^` 可视化编辑。
- Emoji 短代码；Wiki 链接与嵌入卡片；Obsidian `%%注释%%`。
- Frontmatter 元数据卡片；远程图片打开即加载。
- 安全 HTML 子集：保留 `kbd`、`mark`、`details/summary` 等，移除 script、事件属性和危险协议。
- 内部 `#锚点` 跳转、TOC 跳转和脚注回链。

### 编辑与界面

- 导航跟随滚动、唯一 `aria-current`、精确标题对齐、Pin 按文档保存。
- 8 个一级工具栏控件、10 个 More 动作、Insert 键盘菜单、隐藏工具栏、专注模式。
- 原生 VS Code 命令与快捷键、平台化 tooltip、自动消失 toast.
- 复杂扩展（数学、脚注、Alerts、定义列表、TOC、Wiki、注释、HTML、Frontmatter）富渲染 + 点击源码编辑，保持原始 Markdown。
- `==高亮==`、上下标保持完整 ProseMirror 编辑和源码往返。

### 导出与安全

- PDF 导出同步支持扩展语法、脚注、TOC、Frontmatter、KaTeX MathML、definition lists、alerts 和 sanitized HTML。
- PDF 导出会下载并内嵌远程图片。
- 源码仍是唯一数据源；未修改块和 Include 指令保留原文。

## 安装

1. 下载 `markdownup-win32-x64-1.0.0.vsix`。
2. VS Code → Extensions → **… → Install from VSIX…**。
3. 重新加载 VS Code，右键 `.md` 文件选择 **Open With → Modular Markdown Editor**。

要求：**Windows x64**、**VS Code 1.100.0+**。安装包约 126 MB，内含 Mermaid/PDF 使用的 Chromium 引擎。

## 验证

- `npm run check`：lint、typecheck、75 项 Node 测试、生产构建通过。
- `npm run test:ui`：24 项 Playwright 测试通过。
- 真实 VS Code 开发宿主测试通过，安装后 VSIX 宿主测试通过；包含扩展 Markdown → PDF 导出。
- 剪贴板 20/20 系统回读通过。
- 安装包冒烟：5MB 首次可读 248ms / 可编辑 1732ms；输入 P95 24.4ms；短滚动 P95 50.3ms；Mermaid 首图 1702ms（仍高于 1.5s 目标）。
- 资产 SHA-256：`e86b39003d46348cfa6e009f229189c0037a8101a6678f21c46ff2e9f2c6922d`。

## 已知限制

- 复杂扩展源码编辑而非逐 token WYSIWYG；点击块进入原始 Markdown 编辑。
- `![[Page]]` 当前是可点击卡片，不是 Obsidian 式全文转嵌。
- 远程图片打开即加载；PDF 导出远程图片需要网络。
- 稳定发布门禁仍为 **BLOCKED**：30 次冷启动、1000 次输入采样、60 秒滚动、50 次定向保存、30 个 PDF 视觉用例、50 个恢复用例、10 人用户研究和真实 IME 证据尚未完成。
- 当前仅提供 Windows x64 安装包。

详见 [README](https://github.com/singerawei/markdownup#readme) 与 [快捷键审计](https://github.com/singerawei/markdownup/blob/main/docs/KEYBINDINGS.md)。
