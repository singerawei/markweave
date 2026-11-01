# 0.3.0 installed-package results

Measured: 2026-11-01T09:16:50.460Z. Installed extension: 0.3.0. Functional host suite: passed. UI suite (14 cases): passed. Core suite: 64 cases (see ui/check-latest.log).

VSIX SHA-256: `ed3eda27136efe9d39dc42f6223a8522db1085b5242301cacd3ec0c6f263f720`. Runtime hashes: [build.json](build.json). Raw CDP data: [candidate.json](live/candidate.json). Original baseline and methodology: [PERFORMANCE.md](../live/PERFORMANCE.md).

This is one cold/warm Mermaid pair and one opening per document. Times exclude VS Code application boot. Input latency is synthetic keydown to the second updated animation frame; it does not measure physical keyboard/display or real IME latency.

| Mermaid mode | First graph ms | All 20 ms | Count |
| --- | ---: | ---: | ---: |
| cold | 2243.0 | 3592.0 | 20 |
| cached | 293.0 | 366.0 | 20 |

Original cold total was about 16.71–17.05 seconds. Cached results are reported separately.

| Document | Readable ms | Editable ms | Input n | Input P95 ms | Input P99 ms | Native fallback blocks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| single-1MB.md | 140.0 | 481.0 | 100 | 35.8 | 36.6 | 0 |
| single-5MB.md | 138.0 | 1393.0 | 100 | 47.1 | 54.3 | 0 |
| includes-100.md | 144.0 | 1486.0 | 100 | 43.8 | 67.6 | 0 |
| includes-500.md | 140.0 | 2096.0 | 100 | 44.3 | 67.7 | 0 |
| code-102400.md | 132.0 | 132.0 | 100 | 46.5 | 52.5 | 0 |
| code-1048576.md | 126.0 | 153.0 | 0 | — | — | 1 |
| paragraph-100KB.md | 117.0 | 117.0 | 0 | — | — | 1 |
| table-1000rows.md | 125.0 | 125.0 | 0 | — | — | 1 |

Native fallback preserves all source bytes, shows at most 4000 preview characters and offers Text Editor. Limits: 128 KiB code, 16 KiB prose, 200 table rows. Large editable code uses syntax colors near the caret.

| Navigation query | End-to-end ms | Buttons |
| --- | ---: | ---: |
| Local | 283 | 43 |
| nonexistent-review-word | 225 | 3 |
| Chapter | 179 | 43 |

Clipboard OS readback: 0/20 confirmed. Unavailable results are failures, with visible retry feedback. PNG: 20 service renders/signature checks; Chinese representative image inspected. PDF: representative Chinese/include/Mermaid/header/footer page inspected; 30-case visual matrix is pending. Theme screenshots are in live/.

The host's short scroll smoke sample reached 74.0 ms P95 in the slowest scenario; it is not a 60-second acceptance run. No claim of a stable-release pass is made.

## Stable-release gate

The gate remains BLOCKED. Missing samples and manual work are retained as failures:

- Cold first diagram exceeded 1.5 s.
- Insufficient opening repetitions: single-5MB.md
- Insufficient opening repetitions: includes-100.md
- Insufficient opening repetitions: includes-500.md
- OS clipboard acceptance not complete.
- At least 1000 input samples required: prose
- At least 1000 input samples required: code
- At least 1000 input samples required: table
- Missing/pending 60-second scroll gate.
- Missing/pending targeted-save gate.
- User study not complete.
- Real IME acceptance not complete.
- PDF visual matrix not complete.
- Recovery acceptance not complete.

Reproduce: set MARKDOWNUP_TEST_VSIX to the VSIX, run npm run test:review, then node scripts/summarize-review.mjs and npm run release:gate. The last command must fail until all conditions have matching evidence.

## 2026-11-01 development-build update (not installed-VSIX acceptance)

This update implements the navigation, toolbar, keybinding and notification work. It does **not** replace the installed-package measurements above.

- Navigation: one `aria-current` at a time, scroll-following through the heading index with a binary search over the deepest mounted block, 100ms debounce, overlay layout at 320/400/600/900px, current-row auto-scroll that does not move the document, `Pin` persistence per document, and focus return to the editor or the opening button.
- Toolbar: 8 primary controls (style, Bold, Italic, Undo, Redo, Insert, Navigate, More); More has 10 low-frequency actions and no duplicates; `Hide toolbar` persists per document; focus mode leaves only a floating exit control.
- Notifications: fixed source/status rows removed; success and copy toasts dismiss in 3s with no Dismiss button; errors are floating with Details/Retry.
- Mermaid/code: one Diagram actions menu and at most two direct code controls; stale menus and listeners are disposed.
- Keybindings: commands and `contributes.keybindings` added for save, save-as, find, outline (plus Ctrl+Alt+O fallback), pin, toolbar, insert, focus, help and PDF; see [docs/KEYBINDINGS.md](../../KEYBINDINGS.md).
- Clipboard: the host now retries readback 5 times within 1.5s and only reports success after the OS clipboard returns the text. The development host run passed 20/20 readbacks (`bench/results/clipboard.json`).
- Performance: the body-class MutationObserver that re-rendered every mounted segment was removed; the navigation tracker reads only mounted blocks; Mermaid pre-warms the renderer while the document is still being indexed.

Automated checks on this development tree: `npm run lint`, `npm run typecheck`, `npm run build`, 67 Node tests, 23 Playwright UI tests, and `npm run test:host` pass in both development mode and against an installed development VSIX. The installed probe is recorded in [dev-build](dev-build/README.md): VSIX SHA-256 `877d31b971151ad0322c9af5f06b7aa59bb78c927d372284314ef149ea3a15d4`, 20/20 OS clipboard readbacks, 5MB readable 217ms / editable 1970ms, first Mermaid diagram 1883ms for the 5MB diagram corpus and 1696ms for the 1MB corpus. The Mermaid cold-start target was not met in this run. These are smoke samples, not the 30-open/1000-sample/60-second acceptance runs.

Remaining blockers for `npm run release:gate` on a freshly rebuilt and installed VSIX:

- 30 cold opens per 5MB/includes fixture are not collected; current evidence is stale against the new build hash.
- 1000 input samples per prose/code/table and the 60-second scroll gate are not collected.
- The 50-sample targeted-save gate, 30 PDF visual cases, 50 recovery cases, 10-user study and 1000 real-IME commits are not complete.
- Cold first Mermaid diagram remains 1.696s (1MB corpus) and 1.883s (5MB corpus) in the installed development probe; the 1.5s target is not met. Cached behavior still needs a fresh installed measurement.
- No claim is made that `npm run release:gate` passes. It currently reports `RELEASE BLOCKED` for the above evidence.
