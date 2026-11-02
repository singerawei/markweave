# MarkdownUP 1.0.0 preview evidence

Recorded 2026-11-02 from the installed `markdownup-win32-x64-1.0.0.vsix`.

- VSIX SHA-256: `98a462591abcee97ba6fcdf6209ba2d361ea4a8b411cf4747e22d2252d34c882`
- Core/extension tests: 75 passed
- UI tests: 24 passed
- Real VS Code host suite: passed, including extended Markdown → PDF export
- Clipboard: 20/20 verified by OS readback
- Markdown feature probe: [markdown-coverage.json](markdown-coverage.json) (34 syntax samples)
- Host smoke: [vscode.json](vscode.json)

| Case | Readable ms | Editable ms | Input P95 ms | Short scroll P95 ms |
| --- | ---: | ---: | ---: | ---: |
| 1MB | 389 | 833 | 19.6 | 27.7 |
| 5MB | 229 | 1693 | 22.5 | 56.3 |
| 100 includes | 287 | 1735 | 20.3 | 67.3 |
| 1MB + 20 diagrams | 258 | 562 | 21.6 | 27.8 |
| 5MB + 100 diagrams | 156 | 1578 | 20.8 | 61.1 |
| 100 includes + diagrams | 221 | 1693 | 24.3 | 62.3 |

These are short synthetic smoke samples, not the stable-release 30-open / 1000-input / 60-second acceptance matrices. The first Mermaid diagram remains above the 1.5 s target. `npm run release:gate` remains **BLOCKED** because the required manual studies, real IME, PDF visual matrix, recovery matrix, 60-second scrolling and long-run performance evidence are not complete.
