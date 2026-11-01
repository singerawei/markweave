# MarkdownUP 0.3.0-dev.1

**Pre-release** — local-first WYSIWYG Markdown for VS Code.

## Highlights

- Scroll-following navigation with exactly one current heading, Pin per document, overlay layout and ±4px jump alignment.
- Compact 8-control toolbar with a keyboard-operable Insert menu, 10-action More menu, hide/restore and focus mode.
- Native VS Code commands/keybindings, platform-correct tooltips and `aria-keyshortcuts`, plus Help through `?`, `Ctrl+Alt+H` and the Command Palette.
- One Mermaid action menu and at most two direct code-block controls; malformed/stale menu listeners are disposed.
- Floating auto-dismissing success toasts; no permanent source/status row.
- Clipboard success is reported only after the operating system clipboard readback confirms the text.
- Navigation indexing no longer re-renders every mounted segment on theme/body class changes.
- Mermaid renderer prewarms while the document is being indexed.
- Save As compares canonical directories on Windows, so drive-letter casing and 8.3 short paths no longer produce a false "different folder" error.

## Install

1. Download `markdownup-win32-x64-0.3.0.vsix` from this release.
2. In VS Code: **Extensions → … → Install from VSIX…**.
3. Reload VS Code and select **Open With → Modular Markdown Editor** for a local `.md` file.

Requirements: **Windows x64**, **VS Code 1.100.0+**. The VSIX is about 125 MB because it bundles the Chromium engine used for Mermaid and PDF export.

## Verification

- `npm run check`: lint, typecheck, 67 Node tests and production build passed.
- `npm run test:ui`: 23 Playwright UI tests passed.
- Installed-VSIX host suite passed (save, undo/redo, backup/restore, commands, preferences, 20/20 OS clipboard readbacks).
- Asset SHA-256: `ceb1cbe29c24ee45356b510741aea0a2174818c1cf0beab9b5743941dede818c`.

## Known limitations

- This is a development pre-release. `npm run release:gate` remains **BLOCKED** for the stable release: 30 cold opens per large fixture, 1000 input samples per type, a 60-second scroll run, 50 targeted saves, 30 PDF visual cases, 50 recovery cases, a 10-user study and 1000 real-IME commits are not collected.
- Cold Mermaid first-diagram timing is above the 1.5 s target in installed smoke runs.
- Only Windows x64 is packaged in this release.
- Save As must stay in the same directory to preserve relative `@import` paths.

See the [README](https://github.com/singerawei/markdownup#readme) and [keybinding notes](https://github.com/singerawei/markdownup/blob/main/docs/KEYBINDINGS.md) for usage and limitations.
