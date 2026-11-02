# MarkdownUP 1.0.0 (Preview 2)

**本地优先的 VS Code Markdown 所见即所得编辑器。**

这是 1.0.0 的第二个预览构建，补齐了第一轮兼容性审计发现的渲染问题。

## Preview 2 修复

- 支持 `\(...\)` 与 `\[...\]` 数学分隔符，并修复 TeX 中的 `^` 被误判为上标的问题。
- `==高亮==`、下标、上标内部支持嵌套强调/删除线/代码等行内语法。
- 多行 `<details>` 现在会将其中的 Markdown 内容解析并保留在折叠块内。
- `[!NOTE]-`、`[!TIP]+` 等 Obsidian 可折叠 Callout 现在渲染为 `<details>`，`+` 默认展开。
- PDF 导出同步使用以上修复。

## 完整能力

- GFM 表格、任务列表、删除线、裸 URL/尖括号自动链接、引用式链接
- 脚注、GitHub Alerts、Obsidian Callouts、Admonitions
- `$...$`、`$$...$$`、`\(...\)`、`\[...\]` KaTeX MathML 数学
- 定义列表、缩写、TOC、Emoji
- `==高亮==`、上下标（可编辑且可嵌套）
- Wiki 链接/嵌入卡片、Obsidian 注释、Frontmatter 元数据卡片
- 安全 HTML 子集、远程图片打开即加载、内部锚点/脚注/TOC 跳转
- Mermaid、本地 PDF/HTML 扩展导出
- 导航、Pin、紧凑工具栏、原生快捷键、toast、专注模式

复杂扩展采用“富渲染 + 点击源码编辑”，保证不丢失原始 Markdown；标准语法与高亮/上下标保持可视化编辑。

## 安装

1. 下载 `markdownup-win32-x64-1.0.0.vsix`。
2. VS Code → Extensions → **… → Install from VSIX…**。
3. 重新加载 VS Code，右键 `.md` 文件选择 **Open With → Modular Markdown Editor**。

要求：**Windows x64**、**VS Code 1.100.0+**。安装包约 126 MB，内含 Mermaid/PDF 使用的 Chromium 引擎。

## 验证

- `npm run check`：lint、typecheck、76 项 Node 测试、生产构建通过。
- `npm run test:ui`：24 项 Playwright 测试通过。
- 真实 VS Code 开发宿主测试与安装后 VSIX 宿主测试通过，包含扩展 Markdown → PDF 导出。
- 剪贴板 20/20 OS 回读通过。
- 资产 SHA-256：`98a462591abcee97ba6fcdf6209ba2d361ea4a8b411cf4747e22d2252d34c882`。

## 仍待补齐

- Obsidian 行内脚注 `^[...]`、脚注末尾汇总/回链。
- Obsidian 嵌入 `![[Page]]` 目前是可点击卡片，不是全文转嵌。
- `[[Page#Heading]]` 能打开文件，但暂不定位到标题。
- Pandoc/Typora 的标题属性 `{#id .class}`、fenced div `:::`、引用语法等未支持。
- HTML 仍只允许安全白名单子集，不执行 style/iframe/video/script。
- 复杂扩展是富渲染 + 源码编辑，不是逐 token WYSIWYG。
- 稳定发布门禁仍 **BLOCKED**：缺少 30 次冷启动、1000 次输入采样、60 秒滚动、50 次定向保存、30 个 PDF 视觉用例、50 个恢复用例、10 人用户研究和真实 IME 证据；Mermaid 首图仍高于 1.5s。
- 当前仅提供 Windows x64 安装包。
