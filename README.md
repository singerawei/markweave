<p align="center"><img src="media/markweave-logo.png" alt="MarkWeave" width="104"></p>

<h1 align="center">MarkWeave</h1>

<p align="center"><strong>A local-first Markdown editor for VS Code.</strong><br>
Click any block to edit it in place — and keep plain <code>.md</code> files as the source of truth.</p>

<p align="center">
  <strong>English</strong> ·
  <a href="README.zh-CN.md">简体中文</a> ·
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

<p align="center"><img src="media/markweave-hero.png" alt="MarkWeave editing a formatted Markdown document with a table and a syntax-highlighted code block" width="100%"></p>

MarkWeave turns ordinary `.md` files into a click-to-edit document inside VS Code. Your files stay the single source of truth: every save writes Markdown back to the file that owns the content, so Git, your text editor, and every other Markdown tool keep working.

It is built for documents that grow. Compose one continuous document from several files with `@import`, edit any included section in place, and save only the files that actually changed. No account, no database, no telemetry, and no browser required.

> **Preview:** 2.1.0 is a Windows x64 preview. Install it from [GitHub Releases](https://github.com/singerawei/markweave/releases).

## What makes it different

- **Markdown in, Markdown out.** No proprietary format or hidden database. The rendered document and the source file stay in sync.
- **Editable includes.** Import many files into one view; edits go back to the correct source file, including nested and repeated imports.
- **Rendered, not replaced.** Complex blocks stay rendered while you edit them; they never turn into raw text areas.
- **Local-first.** No telemetry and no login. The only network traffic comes from remote images in your document.
- **Comfortable at scale.** Large documents are streamed and rendered near the viewport, with a native editor fallback for oversized blocks.

## Features

- **Click-to-edit** — click any paragraph, heading, list, table, task list, quote, code block, or link and edit it in place.
- **Rich Markdown** — GFM tables, task lists, math, footnotes, alerts and callouts, admonitions, definition lists, TOC, wiki links, highlights, sub/superscript, emoji, frontmatter, and a safe HTML subset.
- **Navigation** — Find and Outline share one panel, follow your scroll position, and can be pinned per document.
- **Mermaid diagrams** — rendered locally and cached; copy, edit, zoom, or export to SVG or PNG.
- **PDF export** — choose paper size, margins, font size, headers, footers, page numbers, and H1 page breaks. Unsaved edits are included.
- **Theme-aware reading** — follows VS Code light, dark, and high-contrast themes.
- **Keyboard-first** — every common action is a VS Code command and can be remapped in Keyboard Shortcuts.
- **Long-document friendly** — progressive loading, viewport rendering, and unloading of distant content keep big files responsive.

## Install

**Requirements:** Windows x64 and VS Code 1.100 or newer. No separate Chrome or Edge installation is needed.

1. Download `markweave-win32-x64-2.1.0.vsix` from [GitHub Releases](https://github.com/singerawei/markweave/releases).
2. In VS Code, open **Extensions**, click **… → Install from VSIX…**, and select the file.
3. Reload VS Code.
4. Right-click any `.md` file and choose **Open With… → Modular Markdown Editor**.

The VSIX is about 125 MB because it bundles the Chromium engine used for Mermaid rendering and PDF export.

<details>
<summary>Build from source</summary>

```sh
git clone https://github.com/singerawei/markweave.git
cd markweave
npm ci
npx playwright install chromium-headless-shell
npm run package
```

Requires Node.js 20.19+ (22 recommended). The generated VSIX is ready to install.
</details>

## Quick start

1. **Open** a `.md` file with **Open With… → Modular Markdown Editor**.
2. **Edit** by clicking any block. Press `Ctrl/Cmd+S` to save or `Ctrl/Cmd+Shift+S` to save as.
3. **Compose** several files into one view:

   ```markdown
   # System design

   @import "./product/overview.md"
   @import "./architecture/system.md"
   @import "./features/payment.md"
   ```

   Edit the rendered sections directly; saving writes only the changed source files.
4. **Navigate** with `Ctrl/Cmd+Shift+O`, insert blocks with `Ctrl/Cmd+Alt+I`, and export with **More → Export PDF**.

## Markdown support

| Syntax | Editing |
| --- | --- |
| CommonMark headings, paragraphs, emphasis, code, quotes, lists, rules | ✅ In place |
| GFM tables, alignment, task lists, strikethrough, autolinks | ✅ In place |
| Highlight `==text==`, subscript, superscript, emoji | ✅ In place |
| Safe HTML (`kbd`, `mark`, `details`, `sub`, `sup`, …) | ✅ Rendered contenteditable, sanitized |
| Math `$...$`, `$$...$$` | ✅ KaTeX, block editor with live preview |
| Footnotes, reference links, definition lists, abbreviations | ✅ Rendered, block editor with live preview |
| GitHub alerts, Obsidian callouts, admonitions | ✅ Rendered, custom titles, foldable |
| TOC, wiki links, Obsidian comments, frontmatter | ✅ Rendered |
| Mermaid | ✅ Rendered locally |
| Remote images | ✅ Loaded on open; downloaded for PDF |

Unsupported syntax is preserved rather than flattened.

## Keyboard shortcuts

| Action | Windows / Linux | macOS |
| --- | --- | --- |
| Save / Save As | `Ctrl+S` / `Ctrl+Shift+S` | `Cmd+S` / `Cmd+Shift+S` |
| Find | `Ctrl+F` | `Cmd+F` |
| Outline / Navigate | `Ctrl+Shift+O` | `Cmd+Shift+O` |
| Insert | `Ctrl+Alt+I` | `Cmd+Alt+I` |
| Focus mode | `Ctrl+Alt+F` | `Cmd+Alt+F` |
| Hide toolbar | `Ctrl+Alt+T` | `Cmd+Alt+T` |
| Help | `?` or `Ctrl+Alt+H` | `?` or `Cmd+Alt+H` |

All shortcuts are VS Code commands and can be remapped. See [docs/KEYBINDINGS.md](docs/KEYBINDINGS.md) for the full list and host conflicts.

## Good to know

- Local `.md` files only. Remote and virtual file systems, cloud sync, and accounts are out of scope.
- **Save As** must stay in the same folder so relative includes keep working.
- Oversized blocks fall back to the Text Editor: code over 128 KiB, prose over 16 KiB, or tables over 200 rows.
- Wiki embeds (`![[Page]]`) open as clickable cards rather than full transclusions.
- The 2.1.0 preview is for Windows x64. The stable release gate is still collecting real-world, IME, long-scroll, and installation evidence.

## Development

```sh
npm ci
npm run check        # lint, typecheck, core tests, build
npx playwright install chromium
npm run test:ui      # UI tests
npm run test:host    # real VS Code host tests
npm run package      # build the VSIX
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow.

## License

MIT. Third-party dependencies and Chromium licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
