# 快捷键与宿主冲突审计（2.0.0）

MarkWeave 不维护自己的快捷键编辑器。所有动作都注册为 `markweave.*` VS Code 命令，并使用 `contributes.keybindings` 与 `activeCustomEditorId == markweave.editor` 条件；用户可以在 **File → Preferences → Keyboard Shortcuts** 中重映射任意命令。

## 默认映射

| 动作 | 命令 | Windows / Linux | macOS | 备用入口 |
| --- | --- | --- | --- | --- |
| 保存 | `markweave.save` | `Ctrl+S` | `Cmd+S` | VS Code 标签页 / 命令面板 |
| 另存为 | `markweave.saveAs` | `Ctrl+Shift+S` | `Cmd+Shift+S` | 命令面板 |
| 查找 | `markweave.find` | `Ctrl+F` | `Cmd+F` | Navigate → Find |
| 大纲 | `markweave.outline` | `Ctrl+Shift+O` 或 `Ctrl+Alt+O` | `Cmd+Shift+O` 或 `Cmd+Alt+O` | Navigate → Outline |
| 上次使用的导航 | `markweave.navigate` | 未绑定 | 未绑定 | Navigate 按钮 |
| 固定导航 | `markweave.pinNavigation` | `Ctrl+Alt+P` | `Cmd+Alt+P` | 导航面板 Pin |
| 显示/隐藏工具栏 | `markweave.toggleToolbar` | `Ctrl+Alt+T` | `Cmd+Alt+T` | More → Hide toolbar / 浮动 Show toolbar |
| 插入 | `markweave.insert` | `Ctrl+Alt+I` | `Cmd+Alt+I` | Insert 按钮 |
| 专注模式 | `markweave.focusMode` | `Ctrl+Alt+F` | `Cmd+Alt+F` | More → Focus mode |
| 帮助 | `markweave.help` | `Ctrl+Alt+H`；不在正文输入时也可按 `?` | `Cmd+Alt+H`；`?` | More → Help / 命令面板 |
| 加粗 | `markweave.bold` | `Ctrl+B` | `Cmd+B` | 工具栏 Bold |
| 斜体 | `markweave.italic` | `Ctrl+I` | `Cmd+I` | 工具栏 Italic |
| 导出 PDF | `markweave.exportPdf` | `Ctrl+Alt+E` | `Cmd+Alt+E` | More → Export PDF / 命令面板 |
| 撤消 / 重做 | `markweave.undo` / `markweave.redo` | 未覆盖宿主默认 | 未覆盖宿主默认 | 工具栏 / 命令面板 |

`Ctrl+Z`、`Ctrl+Shift+Z` 与文本输入控件保持原生行为；正文编辑时由自定义编辑器的宿主历史处理。工具栏 tooltip 与 `aria-keyshortcuts` 使用同一份 `shortcuts.ts` 数据，Windows/Linux 显示 Ctrl，macOS 显示 Cmd，不在界面中硬编码 Ctrl。

## 已知宿主冲突与处理

| 冲突 | 宿主默认 | 处理 |
| --- | --- | --- |
| `Ctrl+F` | 编辑器查找控件 | 仅在 `activeCustomEditorId == markweave.editor` 时接管；导航搜索框内仍可输入。 |
| `Ctrl+Shift+O` | “转到文件中的符号” | 仅作用于 MarkWeave 自定义编辑器，并额外提供 `Ctrl+Alt+O` 备用映射。 |
| `Ctrl+B` / `Ctrl+I` | 部分编辑器的加粗/斜体或缩进命令 | 仅在 MarkWeave 编辑器中接管；用户在 Keyboard Shortcuts 中可再次覆盖。 |
| `Ctrl+S` / `Ctrl+Shift+S` | 全局保存 / 另存为 | 两者最终仍调用 VS Code 的 `workbench.action.files.save` / `saveAs`，不新增第二套保存模型。 |
| `?` | 正文输入 | 只有在焦点不在 input/textarea/select/contenteditable 时才打开帮助，避免吞掉正文问号。 |
| `Ctrl+Alt+P/T/I/F/E/H` | 少数用户/扩展自定义键 | 全部可在原生 Keyboard Shortcuts 中重映射；命令面板始终可用。 |

## 验证边界

- `npm test` 中的结构测试校验：每个默认键位都指向已贡献命令、都带 `when` 条件、PC/mac 映射都存在、Outline 至少有两个可用组合。
- `npm run test:host` 在真实 VS Code 宿主中验证命令注册、按文档偏好持久化和剪贴板回读。
- 浏览器 UI 测试验证 tooltip/`aria-keyshortcuts`、键盘操作、焦点返回、Esc 行为和命令注册表不再通过脆弱的 `#toolbar button[aria-label=...]` 查找。
- **尚未完成**规格要求的“每个动作在真实宿主中 20/20 无冲突”矩阵，以及“10 名用户中 9 人无需帮助完成核心任务”的用户研究。发布门禁仍按失败处理。
