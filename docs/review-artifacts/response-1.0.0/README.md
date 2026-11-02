# MarkdownUP 1.0.0 preview evidence

Recorded 2026-11-02 from the installed `markdownup-win32-x64-1.0.0.vsix`.

- VSIX SHA-256: `e86b39003d46348cfa6e009f229189c0037a8101a6678f21c46ff2e9f2c6922d`
- Core/extension tests: 75 passed
- UI tests: 24 passed
- Real VS Code host suite: passed, including extended Markdown → PDF export
- Clipboard: 20/20 verified by OS readback
- Markdown feature probe: [markdown-coverage.json](markdown-coverage.json) (34 syntax samples)
- Host smoke: [vscode.json](vscode.json)

| Case | Readable ms | Editable ms | Input P95 ms | Short scroll P95 ms |
| --- | ---: | ---: | ---: | ---: |
| 1MB | 353 | 810 | 23.7 | 21.4 |
| 5MB | 248 | 1732 | 24.4 | 50.3 |
| 100 includes | 280 | 1691 | 19.9 | 77.9 |
| 1MB + 20 diagrams | 243 | 535 | 29.1 | 26.7 |
| 5MB + 100 diagrams | 186 | 1676 | 20.1 | 55.5 |
| 100 includes + diagrams | 268 | 1696 | 23.2 | 50.8 |

These are short synthetic smoke samples, not the stable-release 30-open / 1000-input / 60-second acceptance matrices. The first Mermaid diagram remains above the 1.5 s target. `npm run release:gate` remains **BLOCKED** because the required manual studies, real IME, PDF visual matrix, recovery matrix, 60-second scrolling and long-run performance evidence are not complete.
