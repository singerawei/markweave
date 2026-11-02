# MarkWeave 2.0.0 preview evidence

Recorded 2026-11-03 from the installed `markweave-win32-x64-2.0.0.vsix`.

- VSIX SHA-256: `6fff89bed0547e5a37ac4c17e2c005cb6b783cc3ae54efc1c8f19e9c7661dba6`
- Core/extension tests: 76 passed
- UI tests: 24 passed
- Real VS Code host suite: passed, including extended Markdown → PDF export
- Markdown feature probe: [markdown-coverage.json](markdown-coverage.json) (34 samples)
- Host smoke: [vscode.json](vscode.json)
- Clipboard: latest host run **0/20** OS readbacks confirmed; this remains a blocker, not a pass. Raw result: [clipboard.json](clipboard.json)

| Case | Readable ms | Editable ms | Input P95 ms | Short scroll P95 ms |
| --- | ---: | ---: | ---: | ---: |
| 1MB | 261 | 612 | 43.7 | 19.6 |
| 5MB | 210 | 1657 | 41.2 | 63.9 |
| 100 includes | 275 | 1748 | 45.3 | 321.0 |
| 1MB + 20 diagrams | 292 | 551 | 18.2 | 19.2 |
| 5MB + 100 diagrams | 140 | 1525 | 23.9 | 55.1 |
| 100 includes + diagrams | 300 | 1757 | 30.1 | 65.1 |

Short scroll samples are not the 60-second acceptance matrix. The stable release gate remains **BLOCKED** for the required opening repetitions, 1000 input samples per type, 60-second scroll, targeted-save matrix, PDF/recovery matrices, user study, real IME and OS clipboard acceptance. The first Mermaid diagram also remains above 1.5 s.
