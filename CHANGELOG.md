# Changelog

## 1.0.0

- Add GFM autolinks, cross-block reference links, footnotes, GitHub Alerts/Obsidian Callouts, admonitions, definition lists, TOC, abbreviations and Obsidian comments.
- Add KaTeX MathML rendering for inline/block math, fully editable highlight and sub/superscript marks, emoji shortcodes, Wiki links/embeds and clickable internal anchors.
- Add safe HTML allowlist rendering (kbd/mark/details/summary/etc.), frontmatter metadata cards, immediate remote image loading and PDF remote-image embedding.
- Add document-wide reference/abbreviation/TOC context with deferred context rebuilds so typing and large-document scrolling stay responsive.
- Extend PDF export to the new Markdown structures with sanitized HTML and MathML.
- Add 8 extension rendering/security tests, an extended Markdown UI test, an extended PDF host fixture and safe-HTML coverage (75 core tests, 24 UI tests).

## 0.3.0

- Follow the document while scrolling: exactly one current heading, binary-search heading tracking, auto-scroll inside the navigation panel and ±4px jump alignment.
- Add per-document Pinned navigation with Esc/outside-click rules and focus return; overlay the panel at narrow widths without moving the document.
- Converge the toolbar to eight primary controls and ten More actions; remove duplicate commands and the permanent source/status bar.
- Disable formatting and Insert without an edit target, add anchored keyboard menus, and replace warning-style success messages with auto-dismissing floating toasts.
- Register all high-frequency commands and keybindings with VS Code, add platform-correct tooltips/`aria-keyshortcuts`, Help via `?`/Command Palette, and an Outline fallback.
- Reduce Mermaid and code blocks to single action menus, dispose stale menus/listeners, and prewarm the Mermaid renderer during document indexing.
- Scope undo to its focused editor; route Save As separately and enforce read-only edits in the host.
- Preflight all dirty sources before saving and report saved/pending files after a mid-save failure.
- Page navigation results, preserve source state and add same-source paragraph joins and include management.
- Fix fenced code classification, register C++/Protobuf aliases, and retain language controls, syntax colors and indentation while editing.
- Reuse two Mermaid pages with cancellation and bounded caching; export PNG through Chromium screenshots.
- Confirm clipboard writes with bounded readback and report unavailable clipboard access explicitly.
- Simplify responsive toolbars, close menus/dialogs consistently, follow host themes and show source/dirty state.
- Give oversized blocks an explicit native-editor fallback; gate stable releases on matching installed-package evidence.

## 0.2.0

- Replace duplicate header with an English icon toolbar, outline and document search.
- Add process-isolated Mermaid rendering, code highlighting and diagram interactions.
- Add offline PDF export with bundled Windows x64 Chromium, full unsaved include snapshots and print settings.
- Add mixed-diagram performance corpora, PDF host checks and visual inspection artifacts.

## 0.1.0

- Add a local VS Code WYSIWYG custom editor with source-owned Markdown blocks.
- Support nested and shared Markdown imports, cycle/path validation and targeted saves.
- Add external-change conflict handling, undo/redo and hot-exit backups.
- Add lazy segment rendering, one active editor, GFM tables and task lists.
- Add core, round-trip, Git filesystem and browser tests, benchmark generators and VSIX packaging.
