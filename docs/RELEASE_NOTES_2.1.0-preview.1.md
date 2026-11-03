# MarkWeave 2.1.0 (Preview 1)

**本地优先的 VS Code Markdown 所见即所得编辑器。**

2.1.0 聚焦阅读质感、标题层级和“点击不再变原始文本”的可视化编辑。

## 本版变化

### 排版

- 全宽阅读布局，默认最大宽度 1600px，随窗口自适应。
- 正文 16px / 1.8 行高，优化段落、列表、引用、链接、图片间距。
- H1–H6 建立明确层级：H1/H2 分隔线、H4–H6 不小于正文、H6 使用大写灰阶强调。
- 代码块重新设计：圆角、边框、语言/操作栏、等宽字体和更完整的 C++/Python 等语法配色。
- 表格增加滚动外壳、表头样式、斑马纹、悬停高亮和移动端横向滚动。
- PDF 导出同步使用新的标题、代码、表格和语法配色。

### 目录层级

- Outline 面板显示 H1–H6 徽标、逐级缩进和递减字号；当前项保持明显高亮。
- 30k 标题仍使用分页与有界 DOM，不因视觉升级退回全量渲染。

### 所见即所得

- 普通 GFM 表格（含 Emoji、对齐、链接）在原位 ProseMirror 表格中编辑。
- 安全 HTML 块进入原位 rendered `contenteditable` 编辑，不再替换为原始文本。
- 数学、脚注、Alerts、定义列表、Wiki、注释等复杂块打开“带实时预览的块编辑器”；文档中的块始终保持渲染态。
- 引用定义/缩写定义显示为 source card；不安全 HTML 显示安全提示卡；TOC 点击打开导航。
- 所有点击路径都不再出现内联 raw textarea。

## 验证

- `npm run check`：76 项 Node 测试通过。
- `npm run test:ui`：26 项 UI 测试通过，新增标题层级/全宽、表格原位编辑、HTML rendered contenteditable、复杂块编辑器覆盖。
- 真实 VS Code 开发宿主与安装后 VSIX 宿主测试通过。
- 剪贴板 OS 回读 20/20 通过。
- 资产 SHA-256：`ea7e4ada0e90f186ef73a647bdcd9dc51424053a8bccce0bafd913fc2903ee8e`。

## 仍待补齐

- 复杂扩展使用块编辑器与实时预览，不是逐 token 的原地 WYSIWYG。
- 行内脚注 `^[...]`、脚注末尾汇总/回链、Wiki 标题定位和全文嵌入仍未实现。
- Pandoc/Typora 的标题属性、fenced div、citation 等扩展未支持。
- 稳定发布门禁仍 **BLOCKED**：缺少 30 次冷启动、1000 次输入采样、60 秒滚动、50 次定向保存、30 个 PDF 视觉用例、50 个恢复用例、10 人用户研究和真实 IME 证据；Mermaid 首图仍高于 1.5s。

安装：下载 `markweave-win32-x64-2.1.0.vsix`，在 VS Code 中 **Install from VSIX…**。
