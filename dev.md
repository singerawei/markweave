# VS Code 模块化 Markdown WYSIWYG 编辑器开发规格

**文档状态：** 开发规格 / v1.0  
**产品形态：** Visual Studio Code Extension  
**工作名称：** Modular Markdown WYSIWYG Editor  
**核心原则：** Local-first / Markdown-first / Git-friendly / Performance-first

---

# 1. 项目背景

当前 Markdown 非常适合 AI 生成、维护和进行 Git 版本管理，但常见 Markdown 工作流存在两个问题：

1. 编辑 Markdown 时通常需要同时面对“Markdown 源码”和“渲染预览”两个界面。
2. 大型设计文档希望拆成多个独立 Markdown 文件，通过 Include 组合为完整文档，但用户又希望在“完整文档视图”中直接编辑被引用的内容。

目标是开发一个 VS Code 插件，使用户可以像使用 Notion、Typora 或普通富文本编辑器一样编辑 Markdown，同时底层仍然保持：

```text
.md 文件
+
@import 引用关系
+
本地文件系统
+
Git
```

Markdown 文件必须始终是唯一真实数据源。

插件不得把文档转换成专有数据库格式。

---

# 2. 产品核心目标

插件需要实现以下核心体验。

用户打开：

```text
MASTER.md
```

MASTER.md 内容：

```markdown
# 系统设计

@import "./product/overview.md"

@import "./architecture/system.md"

@import "./features/payment.md"
```

插件中看到的应该是一份连续的、已经渲染完成的 WYSIWYG 文档：

```text
系统设计

产品概览
……

系统架构
……

支付模块
……
```

用户不需要看到 Markdown 源码。

用户直接点击：

```text
支付模块
```

中的文字并修改。

如果这部分内容来源于：

```text
features/payment.md
```

那么实际被修改的必须是：

```text
features/payment.md
```

而不是 MASTER.md。

MASTER.md 中：

```markdown
@import "./features/payment.md"
```

必须保持不变。

因此 Git 最终应该看到：

```text
modified: features/payment.md
```

而不是整个 MASTER.md 被重新生成。

---

# 3. 产品边界

## 3.1 必须实现

1. Markdown WYSIWYG 编辑。
2. 单窗口编辑，不需要“左源码、右预览”。
3. `.md` 文件仍然是底层真实文件。
4. 支持 Markdown 文件 Include。
5. 在组合文档中直接编辑 Include 内容。
6. 编辑 Include 内容时写回正确的子 Markdown。
7. Git 可以正常检测真实文件变化。
8. 外部程序修改 Markdown 后，编辑器能够同步。
9. 支持大型 Markdown 文档。
10. 高性能浏览和编辑。
11. 完全本地运行。
12. 可作为标准 VS Code Extension 安装。
13. 可通过 GitHub 开源发布。
14. 可发布到 VS Code Marketplace。

## 3.2 明确不做

v1.0 不实现以下功能：

- 用户注册
- 用户登录
- 云端账号
- 云同步
- 云存储
- 在线协作
- 评论系统
- 权限系统
- AI 功能
- Git 客户端
- Git commit UI
- GitHub 登录
- 团队 Workspace
- 文档分享网站
- 文档数据库
- 后端服务器
- 用户行为追踪
- 广告
- 付费系统

插件应该可以在：

```text
完全离线
```

的情况下正常工作。

---

# 4. 数据原则

这是整个项目最重要的设计原则。

## Markdown 是 Source of Truth

例如：

```text
docs/
├── MASTER.md
├── product/
│   └── overview.md
├── architecture/
│   └── system.md
└── features/
    └── payment.md
```

任何时候真正保存在磁盘上的都必须是这些普通 `.md` 文件。

插件内部可以使用：

- AST
- ProseMirror Document
- 缓存
- Source Map
- Document Graph
- Virtual DOM

但这些都只是运行时数据。

关闭 VS Code 后，不应该依赖它们才能重新打开文档。

---

# 5. Include 语法

第一版采用与 Markdown Preview Enhanced 兼容的基本语法：

```markdown
@import "./features/payment.md"
```

同时允许：

```markdown
<!-- @import "./features/payment.md" -->
```

MPE 已经采用这套文件导入方式，因此保持语法兼容可以降低用户迁移成本。

## v1.0 需要支持

```markdown
@import "./file.md"
```

支持：

- 相对路径
- `.md`
- 嵌套目录
- 嵌套 Markdown Include
- 一个文件被多次引用

例如：

```text
MASTER.md
    ↓
architecture.md
    ↓
database.md
```

允许。

## v1.0 暂不支持

以下 MPE 高级能力暂不实现：

```text
line_begin
line_end
远程 HTTP import
PDF import
CSV import
JS import
CSS import
PlantUML import
任意文件 import
```

第一版只解决：

> Markdown include Markdown

后续再扩展。

---

# 6. Include 的核心行为

假设：

```markdown
# MASTER.md

# 产品

@import "./product.md"

# 技术

@import "./architecture.md"
```

用户最终看到：

```text
产品

产品介绍
……

技术

系统架构
……
```

视觉上应该是一篇连续文章。

但内部必须知道：

```text
“产品”
→ MASTER.md

“产品介绍”
→ product.md

“技术”
→ MASTER.md

“系统架构”
→ architecture.md
```

每一个可编辑内容区域都必须知道自己的：

```typescript
sourceUri
sourceFile
sourcePiece
sourceVersion
```

绝对禁止通过：

> 把所有 Markdown 拼成一个字符串 → 编辑 → 再猜应该拆回哪个文件

来实现。

必须从数据模型层面保存 Source Ownership。

---

# 7. 推荐技术架构

## 7.1 VS Code 层

语言：

```text
TypeScript
```

插件使用：

```text
VS Code Extension API
+
Custom Editor
+
Webview
```

VS Code 官方 Custom Editor API 支持创建完全自定义的读写编辑器，包括 Markdown WYSIWYG 这一类场景。

因为本产品逻辑上编辑的是：

```text
一个组合文档
=
多个实际 Markdown 文件
```

建议工程师评估以：

```text
CustomEditorProvider
```

维护一个 `CompositeDocument`。

不要把架构强行限制成“一个 Editor 对应一个 TextDocument”。

CompositeDocument 至少应包含：

```typescript
interface CompositeDocument {
    rootUri: vscode.Uri
    sources: Map<string, SourceFileModel>
    graph: DocumentGraph
    dirtySources: Set<string>
}
```

---

# 8. WYSIWYG 编辑器

推荐：

```text
Milkdown Core
+
ProseMirror
+
remark
```

Milkdown 本身定位就是 WYSIWYG Markdown editor framework，并基于 ProseMirror 和 remark，采用 MIT License。

不要直接依赖 Milkdown VS Code 插件作为产品主体。

可以阅读它的实现作为参考，但本项目建议：

```text
自己的 VS Code Extension
+
Milkdown 作为编辑器 Library
```

原因是本项目拥有特殊的：

```text
Multi-file composition
Source ownership
Include graph
Large-document performance
```

要求。

Milkdown 官方目前也已有一个 VS Code WYSIWYG 项目，可以作为实现参考。

---

# 9. 文档内部模型

核心对象建议分成三层。

## SourceFileModel

表示一个真实 Markdown 文件。

```typescript
interface SourceFileModel {
    uri: vscode.Uri
    rawText: string
    version: number
    pieces: SourcePiece[]
    dirty: boolean
}
```

## SourcePiece

一个文件不能简单地认为只有“一整个字符串”。

应该拆成：

```typescript
type SourcePiece =
    | MarkdownPiece
    | ImportPiece
```

例如：

```markdown
# Architecture

这里是介绍。

@import "./database.md"

## API

这里是 API。
```

内部可以表示成：

```text
MarkdownPiece
"# Architecture ..."

ImportPiece
"./database.md"

MarkdownPiece
"## API ..."
```

这样修改 Markdown 内容时：

```text
ImportPiece
```

永远不会因为 WYSIWYG 序列化而消失。

## DocumentGraph

管理 Include 关系。

例如：

```text
MASTER.md
├── product.md
├── architecture.md
│   └── database.md
└── payment.md
```

需要支持：

- dependency graph
- cycle detection
- duplicate include detection
- source lookup
- invalid path reporting

---

# 10. WYSIWYG Composition Model

渲染时：

```text
MASTER.md
+
所有 include
```

生成一份 Composite View。

但 Composite View 中每一个区域都保留：

```typescript
{
    sourceUri,
    pieceId,
    includeInstanceId
}
```

建议在 ProseMirror Schema 中增加类似：

```text
source_boundary
```

的内部节点。

用户默认看不到这些边界。

视觉表现仍然应该像一篇普通文章。

开发模式或 Hover 时，可以显示非常轻量的来源提示，例如：

```text
features/payment.md
```

但不能影响正常阅读。

---

# 11. 编辑 Include 内容

假设用户修改：

```text
Stripe
```

变成：

```text
Adyen
```

当前内容属于：

```text
features/payment.md
```

编辑流程必须是：

```text
WYSIWYG transaction
        ↓
识别 source_boundary
        ↓
找到 SourceFileModel
        ↓
更新对应 MarkdownPiece
        ↓
Markdown serializer
        ↓
标记 payment.md dirty
```

保存时只写：

```text
features/payment.md
```

绝对不能重新写：

```text
MASTER.md
product.md
architecture.md
```

---

# 12. Git 友好性

Git 不需要由插件实现。

插件只负责保证：

> 磁盘上的 Markdown 修改是干净、最小、可预测的。

例如：

用户只修改：

```text
payment.md
```

那么：

```bash
git status
```

应该只出现：

```text
modified: features/payment.md
```

不能因为编辑器重新格式化而导致：

```text
10 个没有真正修改的 Markdown 都发生变化
```

---

# 13. Markdown Round-trip Fidelity

这是核心验收项。

必须避免：

```text
Markdown
→ AST
→ WYSIWYG
→ Markdown
```

之后产生大量无意义 diff。

原则：

### 未编辑的 SourcePiece

必须尽可能保持原始字符串。

不要重新 serialize。

### 编辑过的 SourcePiece

只 serialize 修改过的内容。

### Include Directive

必须保留原文。

例如原来：

```markdown
@import "./architecture/system.md"
```

保存后仍应保持相同内容。

---

# 14. 不支持语法的处理原则

最重要的原则：

> 宁可不能 WYSIWYG 编辑，也不能破坏用户 Markdown。

遇到当前插件无法理解的 Markdown 时：

不得：

```text
静默删除
静默转换
保存后丢失
```

应该将该部分表示成：

```text
Raw Markdown Block
```

用户仍然可以看到内容。

必要时允许对这个小区域进行源码编辑。

这是唯一允许出现 Markdown 源码编辑 UI 的特殊情况。

---

# 15. Include 多次引用

例如：

```markdown
@import "./shared/security.md"

...

@import "./shared/security.md"
```

同一文件出现两次。

两个位置必须共享同一个 SourceFileModel。

用户在第一个位置修改：

```text
security.md
```

第二个位置应该同步变化。

不能产生两个独立副本。

---

# 16. Include Cycle

例如：

```text
a.md → b.md
b.md → a.md
```

不能导致：

- 无限递归
- VS Code 卡死
- 内存无限增长

应该终止解析并显示：

```text
Circular include detected:

a.md
→ b.md
→ a.md
```

其余文档仍应尽可能可浏览。

---

# 17. 外部修改同步

这是 AI 使用场景非常重要的一部分。

例如用户正在 WYSIWYG 查看：

```text
payment.md
```

同时 Cursor、Claude Code 或其他程序修改了：

```text
payment.md
```

插件必须监听底层文件变化。

如果当前文件：

```text
没有本地未保存修改
```

则自动重新加载对应 SourceFileModel，并局部更新 UI。

如果：

```text
有本地未保存修改
+
外部又修改同一个文件
```

必须进入 Conflict 状态。

不能自动覆盖任何一边。

可以提示：

```text
payment.md was modified externally.

Reload external version
Keep editor version
View diff
```

v1.0 不要求实现复杂三方合并。

但绝对不能静默覆盖。

---

# 18. 保存模型

CompositeDocument 维护：

```text
dirtySources
```

例如：

```text
dirtySources:
- payment.md
- database.md
```

用户执行 Save：

```text
Ctrl+S / Cmd+S
```

时：

只保存这些文件。

保存完成：

```text
dirtySources.clear()
```

如果一个操作同时修改两个实际文件，则两个文件都写入。

写入失败必须明确报告。

不得出现：

```text
UI 显示保存成功
但磁盘文件没有修改
```

---

# 19. Undo / Redo

v1.0 至少要求：

```text
Ctrl+Z
Ctrl+Shift+Z
```

在当前 WYSIWYG 编辑器中正常工作。

Undo 必须恢复：

```text
编辑器状态
+
对应 SourceFileModel 状态
```

不允许只改变画面而不改变待保存 Markdown。

跨多个文件的一次编辑事务，如果被视为一个动作，则 Undo 也应该保持原子性。

---

# 20. 性能必须作为一级需求

性能不是项目最后的优化项。

必须从第一阶段就建立 Benchmark。

禁止采用以下简单实现：

```text
每一个 @import 永久创建一个完整 Milkdown Editor
```

如果 200 个文件被 Include，就创建 200 个长期运行的 ProseMirror Editor，会产生不必要的：

- 初始化成本
- DOM 数量
- Event Listener
- 内存使用
- Layout/Reflow
- GC 压力

---

# 21. 推荐性能架构

内部从第一天开始采用：

```text
Segment-based Document Model
```

但第一版可以先使用一个统一 ProseMirror/Milkdown 实例验证性能。

Composite Document：

```text
Segment 1
Segment 2
Segment 3
...
```

每个 Segment 都具有 Source Ownership。

如果 Benchmark 达不到下面定义的大文档性能目标，则必须启用：

```text
Large Document Mode
```

Large Document Mode 使用：

```text
Viewport-based rendering
+
Lazy activation
+
Offscreen lightweight rendering
```

核心原则：

用户屏幕附近的内容：

```text
Full WYSIWYG
```

距离视口很远的内容：

```text
轻量 DOM / 静态渲染
```

进入视口附近后再激活完整编辑能力。

不能通过一次性把几十 MB 的复杂 DOM 全部挂到页面来解决大型文档。

---

# 22. 性能实现要求

至少采用以下措施。

## Extension Activation

没有打开插件编辑器时：

```text
不要提前加载 Milkdown
不要建立 Document Graph
不要扫描整个 Workspace
```

仅在需要打开自定义 Markdown Editor 时激活。

## Lazy Loading

以下内容按需加载：

- Markdown parser
- editor runtime
- diagram renderer
- optional syntax extensions

## Debounce

以下操作不得每一个键盘事件都完整执行：

```text
全文 Markdown serialize
全文重新 parse
全文重新 render
全文 include resolution
```

## Incremental Update

修改一个段落：

只更新对应 SourcePiece / Segment。

不能：

```text
每输入一个字
→ 重新解析 MASTER.md
→ 重新读取全部 include
→ 重新生成整个 DOM
```

## Cache

允许缓存：

```text
parsed Markdown
AST
Include resolution
Rendered static segment
```

缓存必须以：

```text
URI + content hash/version
```

进行失效判断。

## Webview

不要默认开启：

```text
retainContextWhenHidden
```

仅为了避免重新初始化而长期保留隐藏 Webview 会增加明显内存成本；VS Code 官方也明确提醒该选项具有较高内存开销。

---

# 23. 性能 Benchmark

开发过程中必须建立自动生成测试 Markdown 的 Benchmark 工具。

至少包含：

## Case A

```text
100 KB
单 Markdown
普通标题/段落/列表
```

## Case B

```text
1 MB
单 Markdown
```

包含：

- headings
- lists
- tables
- code blocks
- links
- images

## Case C

```text
5 MB
单 Markdown
```

## Case D

```text
MASTER.md
+
100 个 include
+
总内容约 5 MB
```

## Case E

```text
500 个小 include
```

用于验证：

- Document Graph
- file resolution
- memory
- DOM
- lazy loading

---

# 24. v1.0 性能验收目标

测试基准机器：

```text
至少 4 核 CPU
16 GB RAM
SSD
当前稳定版 VS Code
```

发布前记录实际测试硬件和 VS Code 版本。

### 1 MB Markdown

冷打开至可阅读：

```text
≤ 1.5 秒
```

开始编辑后的输入延迟：

```text
P95 ≤ 50 ms
```

不允许出现持续明显输入卡顿。

### 5 MB Markdown

第一屏可阅读：

```text
≤ 2 秒
```

第一屏可编辑：

```text
≤ 3 秒
```

允许其他内容继续后台解析。

不能要求用户等待全文完成才显示第一屏。

### 5 MB Composite Document

100 个 include 时：

第一屏：

```text
≤ 2 秒
```

后续内容允许 Lazy Render。

### 输入响应

正常连续输入：

```text
P95 event-to-render ≤ 50 ms
```

不得在每次按键时出现：

```text
>100 ms
```

的持续 Main Thread Blocking。

### Scroll

长文档连续滚动时：

不得频繁发生：

```text
>100 ms
```

的主线程停顿。

### 保存

只修改一个小于 100 KB 的子文件时：

```text
保存处理目标 ≤ 200 ms
```

且不得重新写其他 Source File。

这些数字属于 Release Gate。

如果达不到，应先解决性能问题，再增加新功能。

---

# 25. Markdown v1.0 支持范围

优先支持 CommonMark + 常用 GFM：

- headings
- paragraphs
- bold
- italic
- strikethrough
- ordered lists
- unordered lists
- task lists
- blockquote
- inline code
- fenced code block
- links
- images
- horizontal rule
- tables

以下功能可以在 v1.1+：

- Mermaid
- Math
- Footnotes
- Callout
- WikiLink
- PlantUML
- MPE Code Chunk
- Pandoc

不要为了复制 Markdown Preview Enhanced 的所有功能延误核心功能。

---

# 26. 编辑体验

打开 `.md`：

默认看到：

```text
WYSIWYG
```

而不是：

```text
Markdown Source | Preview
```

必须提供：

```text
Open With → Text Editor
```

作为逃生通道。

用户永远有能力查看真实 Markdown。

但正常工作流程不需要打开源码。

---

# 27. Source Boundary UX

用户正常阅读时：

不要显示明显的大边框。

整体应该像一篇文章。

鼠标移到 Include 区域边缘时，可以轻量提示：

```text
features/payment.md
```

建议提供命令：

```text
Reveal Source File
```

点击后在 VS Code Explorer 或普通文本编辑器中定位原始文件。

这属于辅助功能，不应干扰正常 WYSIWYG。

---

# 28. 安全

插件默认：

```text
无网络请求
无 telemetry
无账号
无登录
```

所有 JS/CSS/字体等运行资源：

```text
打包进 Extension
```

不得依赖 CDN 才能运行。

Webview 应配置严格 CSP。

Markdown 中原始 HTML 不得执行：

```html
<script>
```

或其他可执行脚本。

本地 Markdown 只能作为内容处理。

Include 路径需要防止明显的非法 Path Traversal。

默认只允许 Workspace 内的 Markdown。

---

# 29. 工程目录建议

```text
src/
├── extension/
│   ├── extension.ts
│   ├── editorProvider.ts
│   ├── compositeDocument.ts
│   └── fileWatcher.ts
│
├── document/
│   ├── documentGraph.ts
│   ├── sourceFile.ts
│   ├── sourcePiece.ts
│   ├── includeParser.ts
│   ├── serializer.ts
│   └── conflictManager.ts
│
├── webview/
│   ├── editor.ts
│   ├── schema.ts
│   ├── sourceBoundary.ts
│   ├── renderer.ts
│   └── performance.ts
│
└── shared/
    ├── messages.ts
    └── types.ts
```

测试：

```text
tests/
├── unit/
├── integration/
├── roundtrip/
├── include/
├── conflict/
└── performance/
```

Benchmark：

```text
bench/
├── generator.ts
├── single-large-file.ts
├── many-includes.ts
└── results/
```

---

# 30. 开发阶段

## Phase 1 — VS Code Extension Skeleton

完成：

```text
VS Code Extension
Custom Editor
Webview
Milkdown
```

可以：

```text
Open With → Modular Markdown Editor
```

打开一个普通 Markdown。

验收：

```text
Markdown → WYSIWYG → 修改 → 保存 → Markdown
```

完整闭环。

---

## Phase 2 — Markdown Round-trip

重点解决：

```text
Markdown
→ editor
→ Markdown
```

稳定性。

建立 Round-trip 测试集。

要求：

没有修改的文件：

```text
输入 == 输出
```

或达到预先定义的严格等价标准。

绝不允许数据丢失。

---

## Phase 3 — Include Parser

实现：

```markdown
@import "./xxx.md"
```

建立：

```text
SourceFileModel
SourcePiece
DocumentGraph
```

能够：

```text
MASTER.md
→ resolve
→ child.md
→ render
```

---

## Phase 4 — Editable Include

这是项目最重要的 Milestone。

要求：

```text
打开 MASTER.md
↓
编辑 child.md 内容
↓
保存
↓
只修改 child.md
```

Git：

```bash
git diff
```

必须只出现预期文件。

---

## Phase 5 — Nested / Shared Include

支持：

```text
A → B → C
```

并支持：

```text
A → C
B → C
```

共享 SourceFileModel。

加入：

```text
cycle detection
```

---

## Phase 6 — External File Sync

支持：

```text
Cursor / AI / Text Editor
修改文件
↓
WYSIWYG 自动同步
```

实现冲突检测。

---

## Phase 7 — Performance

使用 Benchmark Corpus。

测试：

```text
100 KB
1 MB
5 MB
100 includes
500 includes
```

如果统一编辑器不能满足性能标准：

启用：

```text
Segment Virtualization
```

直到达到 Release Gate。

---

## Phase 8 — Reliability

覆盖：

- save
- undo
- redo
- external change
- file deleted
- include path missing
- circular include
- duplicate include
- rename
- Unicode
- Windows path
- macOS path
- Linux path

---

## Phase 9 — Packaging

生成：

```text
.vsix
```

VS Code 官方支持使用 `vsce package` 生成可安装 VSIX，并通过 Marketplace 发布插件。

GitHub Release 至少包含：

```text
extension-x.y.z.vsix
```

---

# 31. GitHub Repository

建议使用：

```text
MIT License
```

原因：

- 简单
- 开源友好
- Milkdown 本身也是 MIT
- 方便其他开发者贡献和 Fork

Repository 至少包含：

```text
README.md
LICENSE
CONTRIBUTING.md
CHANGELOG.md
SECURITY.md
package.json
src/
tests/
bench/
.github/workflows/
```

README 重点讲清楚：

```text
WYSIWYG Markdown
+
Editable Includes
+
Local-first
+
Git-friendly
+
Fast large-document editing
```

不要把项目包装成复杂知识管理平台。

---

# 32. CI

GitHub Actions 至少执行：

```text
lint
typecheck
unit tests
integration tests
build
vsix package
```

Release Tag：

```text
v1.0.0
```

自动产生 VSIX。

Marketplace 自动发布建议使用 GitHub Actions + Trusted Publishing/OIDC，而不是长期保存 PAT；VS Code 当前官方发布文档也推荐这种方式。

---

# 33. 最终 v1.0 验收场景

以下全部通过，才能认为 v1.0 完成。

## Acceptance 1 — 单文件

打开：

```text
test.md
```

只看到 WYSIWYG。

直接修改文字。

保存。

重新用普通 Text Editor 打开：

Markdown 内容正确。

---

## Acceptance 2 — Include Rendering

MASTER.md：

```markdown
# Design

@import "./payment.md"
```

打开 MASTER.md。

页面显示：

```text
Design

Payment
……
```

没有第二个预览窗口。

---

## Acceptance 3 — Include Editing

在 MASTER.md 中直接修改 payment.md 的内容。

保存。

检查：

```bash
git status
```

结果：

```text
modified: payment.md
```

MASTER.md 不发生变化。

---

## Acceptance 4 — Git Diff

执行：

```bash
git diff
```

只有真正编辑的 Markdown 内容发生变化。

不得因为 Markdown serializer 产生整篇格式变化。

---

## Acceptance 5 — Nested Include

```text
MASTER.md
→ architecture.md
→ database.md
```

在 MASTER.md 页面编辑 database.md。

实际只修改：

```text
database.md
```

---

## Acceptance 6 — Duplicate Include

同一个文件引用两次。

修改第一处。

第二处实时同步。

磁盘只有一个真实文件变化。

---

## Acceptance 7 — External AI Edit

保持 MASTER.md 打开。

外部工具修改 payment.md。

WYSIWYG 自动更新 payment 区域。

不需要关闭重新打开整个文档。

---

## Acceptance 8 — Conflict

WYSIWYG 中 payment.md 有未保存修改。

外部程序同时修改 payment.md。

插件必须提示冲突。

任何一方内容不得静默丢失。

---

## Acceptance 9 — Broken Include

引用：

```markdown
@import "./missing.md"
```

插件显示明确错误。

其余文档仍然可以编辑。

VS Code 不崩溃。

---

## Acceptance 10 — Circular Include

```text
a.md → b.md → a.md
```

插件检测循环。

不得无限加载。

不得卡死。

---

## Acceptance 11 — Large File

打开 Benchmark 规定的：

```text
1 MB
5 MB
```

Markdown。

达到性能章节定义的 Release Gate。

---

## Acceptance 12 — Large Composite Document

```text
100 includes
约 5 MB 总内容
```

第一屏达到规定打开时间。

浏览和编辑没有明显持续卡顿。

---

## Acceptance 13 — Offline

断开网络。

插件：

```text
打开
浏览
编辑
Include
保存
```

全部正常。

---

## Acceptance 14 — Clean Installation

一台没有开发环境的普通 VS Code：

```text
Install VSIX
↓
打开 Markdown
↓
使用 WYSIWYG
```

不得要求：

```text
Node.js
Python
服务器
数据库
账号
登录
```

---

# 34. v1.0 Definition of Done

项目只有同时满足下面四条才算完成。

### 1. Correct

编辑后的 Markdown 文件内容正确。

Include 永远写回正确 Source File。

### 2. Safe

用户 Markdown 不能因为编辑器不理解某种语法而静默丢失。

### 3. Fast

大型 Markdown 和大量 Include 必须达到明确 Benchmark。

### 4. Simple

用户安装插件以后：

```text
打开 Markdown
→ 阅读
→ 点击
→ 编辑
→ 保存
```

不需要学习新的文件格式、账号体系或服务。

---

# 35. 最核心的工程原则

如果工程实现过程中需要做取舍，按下面优先级决定：

```text
数据不丢失
>
修改正确文件
>
性能
>
Markdown / Git 兼容性
>
编辑体验
>
更多功能
```

不要为了更多功能牺牲前四项。

本项目成功的标准不是：

> 功能很多。

而是：

> 一个非常稳定、非常快、非常简单的 Markdown WYSIWYG VS Code 编辑器，并且真正解决跨文件 Include 编辑问题。

这是整个项目的核心。