# 0.3.0 development VSIX probe — 2026-11-01

This folder records a **development-package probe**, not stable-release acceptance.

- VSIX: `markdownup-win32-x64-0.3.0-dev.vsix`
- VSIX SHA-256: `877d31b971151ad0322c9af5f06b7aa59bb78c927d372284314ef149ea3a15d4`
- VS Code: 1.123.0, isolated profile, extension installed from the VSIX
- Host suite: passed (`save`, ownership, undo/redo, backup/restore, preferences, commands, registered webview)
- Clipboard: 20 samples, 20 verified by OS clipboard readback (`clipboard.json`)
- Webview smoke: `vscode.json` (synthetic `execCommand('insertText')`, frame-to-frame scroll samples, excludes VS Code boot)

Runtime hashes:

| File | SHA-256 |
| --- | --- |
| `dist/editor.js` | `414e8fafa7935e2727980236a5ea6afa5555233687ef5b55b60f70a778a71941` |
| `dist/editor.css` | `f94262c04957481babc68e0ce9f51d6538da07bdce6291e896b39421ed9b2c90` |
| `dist/extension.js` | `b17b3beee873db0b54ff8bfd91197eb82141bd6da4b75290f32491135575cc8e` |
| `dist/mermaid-runtime.js` | `24c819b8cb01c246ab70b0c605af2ffdb221571071b7d3b5eba8eeb978dc455d` |
| `dist/export-renderer.js` | `cb11f42f04375748e89785ab6a84307f567e012e15dfc98e3441ecc3cc8fe8bc` |

Installed-package smoke results (first diagram; 1MB and 5MB diagram corpora):

| Case | Readable ms | Editable ms | First diagram ms | Input P95 ms | Short scroll P95 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1MB | 330 | 880 | — | 19.5 | 24.7 |
| 5MB | 217 | 1970 | — | 19.2 | 47.3 |
| 1MB + 20 diagrams | 259 | 622 | 1696 | 16.9 | 22.6 |
| 5MB + 100 diagrams | 213 | 1849 | 1883 | 21.5 | 57.0 |

`scrollP95` is a short synthetic smoke sample, not the required 60-second run. Input samples are 40 per case, not the required 1000. The 30-open matrix, 1000-sample input matrix, 60-second scroll run, 50-save sample, 30 PDF visual cases, 50 recovery cases, real-IME and 10-user study are **not** included. `npm run release:gate` therefore still fails closed.
