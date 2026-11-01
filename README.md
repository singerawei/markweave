# MarkdownUP

**本地优先的 VS Code Markdown 所见即所得编辑器。**

MarkdownUP 让 `.md` 文件保持为唯一数据源，同时提供点击即编辑的可视化体验。它支持 `@import` 跨文件组合；在同一篇连续文档中编辑被引用内容时，保存只会写回真正变化的源文件。无需账号、数据库、网络或浏览器。

> 当前版本：`0.3.0`（Windows x64 开发版）。核心流程与自动化测试通过；稳定发布所需的完整人工/性能验收仍在收集中。

## 功能特性

- **所见即所得编辑**：点击任意段落直接编辑，标题、列表、表格、任务列表、引用、代码和链接保持 Markdown 源码语义。
- **可编辑 Includes**：嵌套与重复 `@import`，重复引用同步更新；保存只写目标源文件，未修改块和 Import 指令保留原文。
- **可靠的源文件所有权**：循环/丢失 Include 局部报错，外部修改检测、冲突处理、热退出备份与恢复，多面板同步。
- **导航与大纲**：Find / Outline 共用面板，标题随滚动高亮，点击结果精确对齐；Pin 固定导航并按文档保存。
- **紧凑工具栏**：8 个一级控件；Insert 锚定菜单支持方向键/Home/End/Esc；工具栏可隐藏、可恢复、可进入专注模式。
- **原生快捷键**：所有高频动作都是 VS Code 命令，可在 Keyboard Shortcuts 中重映射；tooltip 与 `aria-keyshortcuts` 平台化显示 Ctrl/Cmd。
- **Mermaid 与代码块**：Mermaid 使用本地 Chromium 渲染、预热点、缓存与过期请求取消；图表和代码块各自只有一个操作菜单。
- **长文档友好**：分批传输、视口附近按需渲染、远处卸载 DOM；超出编辑上限的块保留完整原文并提供 Text Editor 入口。
- **PDF 导出**：包含未保存修改和完整 Include 内容，支持纸张、边距、字号、页眉页脚、页码、H1 分页与预览。
- **本地优先**：无遥测、无网络请求、无账号；主题跟随 VS Code，支持浅色、深色和高对比度。

## 安装

### 从 Release 安装（推荐）

安装包作为 GitHub Release 资源提供，不直接提交到 Git 仓库，因为 VSIX 约 125 MB（内含 Mermaid/PDF 使用的 Chromium 引擎）。

1. 打开 [GitHub Releases](https://github.com/singerawei/markdownup/releases)，下载 `markdownup-win32-x64-0.3.0.vsix`。
2. 在 VS Code 中打开扩展视图，点击 **… → Install from VSIX…**，选择下载的文件。
3. 重新加载 VS Code。
4. 右键任意 `.md` 文件，选择 **Open With → Modular Markdown Editor**。

要求：**Windows x64**，**VS Code 1.100.0 或更高版本**。不需要额外安装 Chrome/Edge。

### 从源码构建

```sh
git clone https://github.com/singerawei/markdownup.git
cd markdownup
npm ci
npx playwright install chromium-headless-shell
npm run package
```

生成的 `markdownup-win32-x64-0.3.0.vsix` 可直接安装。开发调试可运行 `npm run check`、`npm run test:ui` 和 `npm run test:host`，或按 F5 启动扩展开发宿主。

## 使用教程

### 1. 打开文档

右键 `.md` 文件 → **Open With…** → **Modular Markdown Editor**。如果文件被文本编辑器接管，使用 **Reopen Editor With…** 切换。文档标题和未保存状态由 VS Code 标签页显示。

### 2. 编辑与保存

点击正文中的任意块开始编辑，`Ctrl+S` 保存，`Ctrl+Shift+S` 另存为。`Ctrl+Z` / `Ctrl+Shift+Z` 使用 VS Code 的文档历史；输入框内保留原生撤销行为。跨文件的选择、拖放不会被拆分到多个源文件。

### 3. 使用 Include 组合文档

```markdown
# 系统设计

@import "./product/overview.md"

@import "./architecture/system.md"

@import "./features/payment.md"
```

在渲染后的连续文档中直接编辑被引用内容即可。保存时只写回发生变化的目标文件。新增或移除 Include 使用 **More → Manage includes**。

### 4. 导航、固定与插入

- **Navigate**：打开上次使用的 Find 或 Outline；再次触发会关闭面板（未固定时）。
- **Pin**：将导航固定为常驻面板，状态按文档保存；固定后 Esc 不会关闭。
- **Insert**：插入列表、代码块、表格、链接、图片、分隔线、Mermaid 等。没有编辑目标时按钮会禁用。
- **More**：导出 PDF、管理 Include、阅读宽度、专注模式、文字大小、只读预览、查看源码、帮助和隐藏工具栏。

### 5. Mermaid 与代码块

Mermaid 图表渲染完成后，点击 **Diagram actions** 可复制、编辑、缩放、查看和导出 SVG/PNG。代码块使用语言选择器 + **Code actions** 菜单，支持复制与换行。复制只有在操作系统剪贴板回读成功后才提示成功。

### 6. 导出 PDF

打开 **More → Export PDF**，选择纸张、边距、字号、页眉页脚和页码，可先预览再导出。导出会包含当前未保存内容，但不会自动保存 Markdown。

## 快捷键

| 动作 | Windows / Linux | macOS |
| --- | --- | --- |
| 保存 / 另存为 | `Ctrl+S` / `Ctrl+Shift+S` | `Cmd+S` / `Cmd+Shift+S` |
| 查找 / 大纲 | `Ctrl+F` / `Ctrl+Shift+O` | `Cmd+F` / `Cmd+Shift+O` |
| 插入 | `Ctrl+Alt+I` | `Cmd+Alt+I` |
| 固定导航 | `Ctrl+Alt+P` | `Cmd+Alt+P` |
| 隐藏/显示工具栏 | `Ctrl+Alt+T` | `Cmd+Alt+T` |
| 专注模式 | `Ctrl+Alt+F` | `Cmd+Alt+F` |
| 帮助 | `?` 或 `Ctrl+Alt+H` | `?` 或 `Cmd+Alt+H` |
| 加粗 / 斜体 | `Ctrl+B` / `Ctrl+I` | `Cmd+B` / `Cmd+I` |

所有快捷键都注册为 VS Code 命令，可在 **Keyboard Shortcuts** 中重映射。Outline 另提供 `Ctrl+Alt+O` 备用映射。完整的宿主冲突说明见 [docs/KEYBINDINGS.md](docs/KEYBINDINGS.md)。

## 设计边界

- 仅支持本地工作区中的 `.md` 文件；远程/虚拟文件系统、云同步和账号功能不在当前范围内。
- 跨来源的复杂结构重排请在 Text Editor 中完成；单次编辑只归属一个源文件。
- Save As 需要保持在同一目录，以维持相对 Include 语义。
- 单块可视编辑上限：代码 128 KiB、正文 16 KiB、表格 200 行；超出后保留完整原文并引导到 Text Editor。
- 当前提供的安装包为 Windows x64 开发版；完整稳定发布仍需收集用户研究、真实 IME、长时间滚动和安装包验收证据。

## 项目结构

```text
src/document   块解析、来源模型、Include 图、冲突与保存
src/extension  VS Code CustomEditorProvider、PDF、Mermaid 服务
src/webview    ProseMirror + markdown-it 前端、导航、工具栏、样式
scripts        构建、打包、发布门禁与宿主测试
tests          核心、往返、结构、宿主和 Playwright UI 测试
bench          长文档/性能测试语料与结果
docs           使用说明、快捷键审计与验收记录
```

## 开发

```sh
npm ci
npm run check        # lint + typecheck + 67 项核心测试 + build
npx playwright install chromium
npm run test:ui      # 23 项 UI 测试
npm run test:host    # 真实 VS Code 宿主测试
npm run bench
npm run package
npm run release:gate # 证据不足或超阈值时按设计失败
```

需要 Node.js 20.19+（推荐 22）。VSIX 打包会把本地 Chromium 引擎一起放入安装包，因此体积约 125 MB。

## License

MIT. 第三方依赖与 Chromium 许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 和 [LICENSE](LICENSE)。
