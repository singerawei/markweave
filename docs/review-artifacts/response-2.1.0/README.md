# MarkWeave 2.1.0 preview evidence

Recorded 2026-11-03 from the installed `markweave-win32-x64-2.1.0.vsix`.

- VSIX SHA-256: `ea7e4ada0e90f186ef73a647bdcd9dc51424053a8bccce0bafd913fc2903ee8e`
- Core/extension tests: 76 passed
- UI tests: 26 passed
- Real VS Code host suite: passed, including extended Markdown → PDF export
- OS clipboard: 20/20 confirmed
- Typography: [typography.png](typography.png)
- Outline hierarchy: [outline-hierarchy.png](outline-hierarchy.png)
- Table rendering: [table-visual.png](table-visual.png)
- Markdown feature probe: [markdown-coverage.json](markdown-coverage.json)

| Case | Readable ms | Editable ms | Input P95 ms | Short scroll P95 ms |
| --- | ---: | ---: | ---: | ---: |
| 1MB | 329 | 783 | 23.7 | 24.9 |
| 5MB | 221 | 1703 | 26.8 | 52.9 |
| 100 includes | 280 | 1829 | 20.1 | 61.3 |
| 1MB + 20 diagrams | 275 | 565 | 24.0 | 21.7 |
| 5MB + 100 diagrams | 176 | 1653 | 20.2 | 53.1 |
| 100 includes + diagrams | 224 | 1665 | 20.8 | 75.2 |

Short synthetic samples; not the 60-second scroll acceptance matrix. The stable release gate remains **BLOCKED** for opening/input/save/PDF/recovery/user-study/IME evidence and Mermaid cold-start targets.
