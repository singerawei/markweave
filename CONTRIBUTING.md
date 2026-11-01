# Contributing

Use Node.js 20.19+ (22 recommended), run `npm ci`, then `npm run check`.
Run `npx playwright install chromium` once before `npm run test:ui`.

Before submitting a change, verify `npm run bench` and `npm run package` as well.
Never regenerate untouched Markdown blocks or flatten included content into the root file.
Include regressions for ownership, data loss, conflicts or security fixes. Preserve unsupported syntax.

Performance reports must identify the machine, VS Code version and measurement scope.
Headless browser or model timings alone cannot certify the final VS Code release gates in `dev.md`.
