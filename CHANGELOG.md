# Changelog

## 2.1.1

- Change the Marketplace publisher to `singeraw`; the extension identifier is now `singeraw.markweave`.
- Refine reading typography toward the VS Code/GitHub Markdown preview: clearer H1–H6 scale, tighter spacing, calmer links and quotes, bordered tables with zebra rows, and quieter code blocks.
- Add automated dark-theme palette coverage and refresh the generated UI screenshots.
- Rewrite the README in English with a hero screenshot, and add 简体中文, 日本語, 한국어, Español, Français, Deutsch and Русский editions with a shared language picker.
- Windows x64 preview for VS Code 1.100+.

## 2.1.0

- Rebuild document typography: full-width reading layout, larger readable body text, distinct H1–H6 scale, heading rules, improved lists/quotes/links/images.
- Redesign code blocks and syntax colors for C++, Python and other languages; style language/action bars and inline code.
- Add table scroll shells, header styling, zebra rows and hover states; wrap tables without changing layout.
- Show heading level badges, indentation and distinct sizes in the outline panel.
- Make common GFM tables (including emoji cells) editable in ProseMirror instead of falling back to source.
- Add in-place rendered `contenteditable` editing for safe HTML blocks; HTML no longer turns into an inline raw textarea.
- Replace inline raw editors for complex Markdown with a rendered block editor (live preview + source) and source cards for definitions/unsafe HTML; clicking TOC opens navigation.
- Improve PDF print typography, headings, code, tables and syntax colors.
- Add heading hierarchy, table/HTML WYSIWYG and complex-block visual editor tests (76 core, 26 UI).

## 2.0.0

- **Rebrand:** MarkdownUP is now **MarkWeave**, with a new logo, GitHub repository, extension ID, command/settings prefix, custom-editor view type and VSIX naming.
- The extension identifier changes from `markdownup.markdownup` to `markweave.markweave`; install the new VSIX and reapply settings. Existing MarkdownUP releases remain available for rollback.
- Add transparent icon assets in `media/` and use the logo in the README and extension package.
- Keep the full extended Markdown rendering set introduced in 1.x, including math delimiters, nested marks, `<details>` Markdown, foldable callouts, footnotes, alerts, TOC, wikis and safe HTML.
- Update CI, host tests, release gate paths, notifications, source markers and documentation to the MarkWeave identity.

## 1.0.0

- Add `\(...\)` and `\[...\]` math delimiters, nested emphasis inside highlight/sub/superscript, Markdown parsed inside block `<details>`, and foldable `[!NOTE]-` / `[!TIP]+` callouts.
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
