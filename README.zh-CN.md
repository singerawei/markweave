<p align="center"><img src="media/markweave-logo.png" alt="MarkWeave" width="104"></p>

<h1 align="center">MarkWeave</h1>

<p align="center"><strong>面向 VS Code 的本地优先 Markdown 编辑器。</strong><br>
点击任意块即可原位编辑，纯 <code>.md</code> 文件始终是唯一数据源。</p>

<p align="center">
  <a href="README.md">English</a> ·
  <strong>简体中文</strong> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.ru.md">Русский</a>
</p>

<p align="center">
  <a href="https://github.com/singerawei/markweave/releases"><img src="https://img.shields.io/github/v/release/singerawei/markweave?include_prereleases&label=release&style=flat-square" alt="Release"></a>
  <img src="https://img.shields.io/badge/platform-Windows%20x64-0078D6?style=flat-square" alt="Windows x64">
  <img src="https://img.shields.io/badge/VS%20Code-1.100%2B-007ACC?style=flat-square" alt="VS Code 1.100+">
  <img src="https://img.shields.io/badge/license-MIT-2ea44f?style=flat-square" alt="MIT">
</p>

<p align="center"><img src="media/markweave-hero.png" alt="MarkWeave 正在编辑一篇包含表格和高亮代码块的 Markdown 文档" width="100%"></p>

MarkWeave 把普通的 `.md` 文件变成 VS Code 中点击即可编辑的文档。文件始终是唯一数据源：每次保存都会把 Markdown 写回真正拥有该内容的文件，因此 Git、文本编辑器以及其它 Markdown 工具都能继续使用。

它为会不断增长的文档而设计。用 `@import` 把多个文件组合成一篇连续文档，直接编辑被引用的章节，保存时只写回真正发生变化的源文件。无需账号、数据库或遥测，也不需要浏览器。

> **预览版：** 2.1.1 是 Windows x64 预览版。请从 [GitHub Releases](https://github.com/singerawei/markweave/releases) 安装。

## 特色

- **Markdown 进，Markdown 出。** 没有私有格式，也没有隐藏数据库。渲染结果与源文件始终同步。
- **Include 可直接编辑。** 把多个文件引入同一视图；编辑会写回正确的源文件，嵌套引用和重复引用同样适用。
- **保持渲染态，而不是打回原文。** 复杂块在编辑时始终保持渲染效果，不会变成一块原始文本输入框。
- **本地优先。** 无遥测、无登录。唯一的网络请求来自文档中的远程图片。
- **长文档依然从容。** 大文档分批加载、只在视口附近渲染；超大块会回退到原生编辑器。

## 功能

- **点击即编辑** — 段落、标题、列表、表格、任务列表、引用、代码块和链接都能原位编辑。
- **丰富的 Markdown** — GFM 表格、任务列表、数学公式、脚注、Alerts/Callouts、Admonitions、定义列表、TOC、Wiki 链接、高亮、上下标、Emoji、Frontmatter 和安全 HTML 子集。
- **导航** — Find 与 Outline 共用一个面板，随滚动定位，可按文档固定。
- **Mermaid 图表** — 本地渲染并缓存；支持复制、编辑、缩放和导出 SVG/PNG。
- **PDF 导出** — 可设置纸张、边距、字号、页眉页脚、页码和 H1 分页，并包含未保存的修改。
- **跟随主题** — 自动适配 VS Code 的浅色、深色和高对比度主题。
- **键盘优先** — 常用操作都是 VS Code 命令，可在「键盘快捷方式」中重新映射。
- **适合长文档** — 渐进加载、视口渲染和远处内容卸载，让大文件保持流畅。

## 安装

**要求：** Windows x64，VS Code 1.100 或更高版本。无需单独安装 Chrome 或 Edge。

1. 从 [GitHub Releases](https://github.com/singerawei/markweave/releases) 下载 `markweave-win32-x64-2.1.1.vsix`。
2. 在 VS Code 中打开「扩展」，点击 **… → 从 VSIX 安装…**，选择该文件。
3. 重新加载 VS Code。
4. 右键任意 `.md` 文件，选择 **打开方式… → Modular Markdown Editor**。

VSIX 约 125 MB，因为其中打包了 Mermaid 渲染和 PDF 导出所需的 Chromium 引擎。

<details>
<summary>从源码构建</summary>

```sh
git clone https://github.com/singerawei/markweave.git
cd markweave
npm ci
npx playwright install chromium-headless-shell
npm run package
```

需要 Node.js 20.19+（推荐 22）。生成的 VSIX 可直接安装。
</details>

## 快速开始

1. 用 **打开方式… → Modular Markdown Editor** 打开 `.md` 文件。
2. 点击任意块进行编辑。`Ctrl/Cmd+S` 保存，`Ctrl/Cmd+Shift+S` 另存为。
3. 把多个文件组合成一篇文档：

   ```markdown
   # 系统设计

   @import "./product/overview.md"
   @import "./architecture/system.md"
   @import "./features/payment.md"
   ```

   直接编辑渲染后的章节；保存时只会写回发生变化的源文件。
4. 用 `Ctrl/Cmd+Shift+O` 导航，用 `Ctrl/Cmd+Alt+I` 插入块，通过 **More → Export PDF** 导出。

## Markdown 支持

| 语法 | 编辑方式 |
| --- | --- |
| CommonMark 标题、段落、强调、代码、引用、列表、分隔线 | ✅ 原位编辑 |
| GFM 表格、对齐、任务列表、删除线、自动链接 | ✅ 原位编辑 |
| 高亮 `==文本==`、上下标、Emoji | ✅ 原位编辑 |
| 安全 HTML（`kbd`、`mark`、`details`、`sub`、`sup` 等） | ✅ 渲染态 contenteditable，已净化 |
| 数学 `$...$`、`$$...$$` | ✅ KaTeX，块编辑器带实时预览 |
| 脚注、引用式链接、定义列表、缩写 | ✅ 富渲染，块编辑器带实时预览 |
| GitHub Alerts、Obsidian Callouts、Admonitions | ✅ 富渲染，支持自定义标题与折叠 |
| TOC、Wiki 链接、Obsidian 注释、Frontmatter | ✅ 富渲染 |
| Mermaid | ✅ 本地渲染 |
| 远程图片 | ✅ 打开即加载；导出 PDF 时下载并内嵌 |

不支持的语法会原样保留，而不是被压平。

## 快捷键

| 操作 | Windows / Linux | macOS |
| --- | --- | --- |
| 保存 / 另存为 | `Ctrl+S` / `Ctrl+Shift+S` | `Cmd+S` / `Cmd+Shift+S` |
| 查找 | `Ctrl+F` | `Cmd+F` |
| 大纲 / 导航 | `Ctrl+Shift+O` | `Cmd+Shift+O` |
| 插入 | `Ctrl+Alt+I` | `Cmd+Alt+I` |
| 专注模式 | `Ctrl+Alt+F` | `Cmd+Alt+F` |
| 隐藏工具栏 | `Ctrl+Alt+T` | `Cmd+Alt+T` |
| 帮助 | `?` 或 `Ctrl+Alt+H` | `?` 或 `Cmd+Alt+H` |

所有快捷键都是 VS Code 命令，可重新映射。完整列表与宿主冲突说明见 [docs/KEYBINDINGS.md](docs/KEYBINDINGS.md)。

## 注意事项

- 仅支持本地 `.md` 文件。远程/虚拟文件系统、云同步和账号功能不在当前范围内。
- **另存为** 必须保持在同一目录，以维持相对 Include 语义。
- 超出编辑上限的块会回退到文本编辑器：代码 128 KiB、正文 16 KiB、表格 200 行。
- Wiki 嵌入 `![[Page]]` 以可点击卡片呈现，而不是完整的全文转嵌。
- 2.1.1 预览版面向 Windows x64。稳定发布门禁仍在收集真实用户、输入法、长滚动和安装验收证据。

## 开发

```sh
npm ci
npm run check        # lint、类型检查、核心测试、构建
npx playwright install chromium
npm run test:ui      # UI 测试
npm run test:host    # 真实 VS Code 宿主测试
npm run package      # 构建 VSIX
```

贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

MIT。第三方依赖与 Chromium 许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
