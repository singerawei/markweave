# MarkWeave 2.0.0 (Preview 1)

**本地优先的 VS Code Markdown 所见即所得编辑器。**

MarkWeave 是 MarkdownUP 的完整品牌升级：新名称、新 Logo、新扩展标识和新仓库。

## 重大变化

- 产品名：**MarkdownUP → MarkWeave**
- GitHub 仓库：`singerawei/markdownup` → `singerawei/markweave`
- VS Code 扩展 ID：`markdownup.markdownup` → `markweave.markweave`
- 命令/设置前缀：`markdownup.*` → `markweave.*`
- 自定义编辑器 viewType：`markdownup.editor` → `markweave.editor`
- 安装包：`markweave-win32-x64-2.0.0.vsix`
- 新 Logo：透明 PNG，位于 `media/markweave-logo.png` 和 `media/markweave-icon.png`

**升级说明：** 这是带新扩展 ID 的完整改名版本。请安装新的 VSIX 并重新设置选项；旧 MarkdownUP 安装不会被覆盖，旧 Release 仍可用于回滚。

## 功能

- GFM 表格、任务列表、删除线、自动链接、引用式链接
- 脚注、GitHub Alerts、可折叠 Obsidian Callouts、Admonitions
- `$...$`、`$$...$$`、`\(...\)`、`\[...\]` KaTeX MathML 数学
- 定义列表、缩写、TOC、Emoji、Wiki 链接/嵌入卡片、Obsidian 注释
- `==高亮==`、上下标（可编辑且支持内部嵌套格式）
- 安全 HTML 子集、`<details>` 内 Markdown、Frontmatter 元数据卡片
- 远程图片打开即加载，PDF 导出下载并内嵌
- Mermaid、本地 PDF 导出
- 滚动的导航大纲、Pin、紧凑工具栏、原生快捷键、Focus Mode

复杂扩展采用“富渲染 + 点击源码编辑”，标准语法与高亮/上下标保持可视化编辑。

## 安装

1. 下载 `markweave-win32-x64-2.0.0.vsix`。
2. VS Code → Extensions → **… → Install from VSIX…**。
3. 重新加载 VS Code，右键 `.md` 文件选择 **Open With → Modular Markdown Editor**。

要求：**Windows x64**、**VS Code 1.100.0+**。安装包约 126 MB，内含 Mermaid/PDF 使用的 Chromium 引擎。

## 验证

- `npm run check`：lint、typecheck、76 项 Node 测试、生产构建通过。
- `npm run test:ui`：24 项 Playwright 测试通过。
- 真实 VS Code 开发宿主测试与安装后 VSIX 宿主测试通过，包含扩展 Markdown → PDF 导出。
- 资产 SHA-256：`6fff89bed0547e5a37ac4c17e2c005cb6b783cc3ae54efc1c8f19e9c7661dba6`。

## 仍待补齐

- Obsidian 行内脚注 `^[...]`、脚注末尾汇总/回链。
- `![[Page]]` 是可点击卡片，不是全文转嵌；`[[Page#Heading]]` 暂不定位到标题。
- Pandoc/Typora 标题属性、fenced div、citation 等扩展未支持。
- HTML 仅安全白名单子集，不执行 style/iframe/video/script。
- 复杂扩展是富渲染 + 源码编辑，不是逐 token WYSIWYG。
- 稳定发布门禁仍 **BLOCKED**：缺少 30 次冷启动、1000 次输入采样、60 秒滚动、50 次定向保存、30 个 PDF 视觉用例、50 个恢复用例、10 人用户研究和真实 IME 证据；最新宿主剪贴板 OS 回读为 0/20，需要修复环境/重试策略；Mermaid 首图仍高于 1.5s。

详见 [README](https://github.com/singerawei/markweave#readme) 与 [快捷键审计](https://github.com/singerawei/markweave/blob/main/docs/KEYBINDINGS.md)。
