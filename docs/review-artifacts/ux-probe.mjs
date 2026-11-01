import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Product-review probes against the production webview bundle.
// Host messages are recorded; this harness does not certify VS Code integration.
const out = resolve('docs/review-artifacts');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: resolve('engine/chrome-headless-shell.exe'), headless: true });
let page;
const messages = [];
const pageErrors = [];
const sourceUri = 'file:///C:/review/MASTER.md';
function segment(text, index, editable = true) {
  return { id: `root:p${index}`, pieceId: `p${index}`, sourceUri, sourceFile: 'MASTER.md', includeInstanceId: 'root', sourceVersion: 1, text, editable, resourceBase: 'http://localhost/review' };
}
async function load(items) {
  await page?.close();
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.exposeFunction('reviewHost', message => messages.push(message));
  await page.setContent('<span id="status" role="status" class="sr-only"></span><nav id="toolbar"></nav><aside id="conflicts"></aside><div id="notice" hidden></div><main id="document"></main>');
  await page.evaluate(() => { window.acquireVsCodeApi = () => ({ postMessage: message => window.reviewHost(message), getState: () => ({}), setState: () => {} }); });
  await page.addStyleTag({ path: resolve('dist/editor.css') });
  await page.addScriptTag({ path: resolve('dist/mermaid-runtime.js') });
  await page.addScriptTag({ path: resolve('dist/editor.js') });
  await page.evaluate(segments => window.postMessage({ type: 'document', title: 'Review', segments }, '*'), items);
  await page.locator('.segment').first().waitFor();
}
const observations = {};
try {
  await load([segment('First paragraph.\n\n', 0), segment('Second paragraph.\n', 1)]);
  await page.locator('.segment').first().click();
  await page.locator('.ProseMirror').press('Control+End');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.type('Q');
  observations.arrowDownAcrossParagraphs = await page.locator('.segment').allTextContents();
  await page.keyboard.press('Control+a');
  observations.selectAll = await page.evaluate(() => window.getSelection()?.toString());
  await page.locator('.segment').nth(1).click();
  await page.locator('.ProseMirror').press('Control+Home');
  await page.keyboard.press('Backspace');
  observations.backspaceAtSecondParagraph = await page.locator('.segment').allTextContents();
  await page.evaluate(() => window.postMessage({ type: 'status', dirty: ['file:///C:/review/child.md'], conflicts: [] }, '*'));
  observations.saveStatus = await page.locator('#status').evaluate(el => ({ text: el.textContent, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height, clipPath: getComputedStyle(el).clipPath }));
  await page.screenshot({ path: resolve(out, 'editing.png') });

  await load([segment('# Title\n\n', 0), segment('Setext title\n-----------\n\n', 1), segment('The needle is here.\n', 2), segment('[Go to title](#title)\n', 3)]);
  await page.getByRole('button', { name: 'Outline', exact: true }).click();
  observations.outlineEntries = await page.locator('#navigation button').allTextContents();
  await page.keyboard.press('Control+f');
  await page.getByLabel('Find in document').fill('needle');
  await page.waitForFunction(() => document.querySelectorAll('#navigation button').length === 1);
  await page.keyboard.press('Escape');
  observations.findRemainsOpenAfterEscape = await page.locator('#navigation').isVisible();
  await page.locator('#navigation button').click();
  observations.findJump = await page.evaluate(() => ({ markedText: document.querySelectorAll('mark').length, activeElement: document.activeElement?.className, selection: window.getSelection()?.toString() }));
  const beforeAnchorMessages = messages.length;
  await page.getByRole('link', { name: 'Go to title' }).click();
  observations.anchorMessages = messages.slice(beforeAnchorMessages).filter(item => item.type === 'link');
  await page.setViewportSize({ width: 400, height: 700 });
  if (!(await page.locator('#navigation').isVisible())) await page.getByRole('button', { name: 'Outline', exact: true }).click();
  observations.narrowNavigation = await page.locator('#navigation').evaluate(el => ({ panelWidth: el.getBoundingClientRect().width, viewportWidth: innerWidth, overlay: getComputedStyle(el).position }));
  await page.screenshot({ path: resolve(out, 'narrow.png') });

  await page.setViewportSize({ width: 1280, height: 900 });
  await load([segment('```mermaid\nflowchart LR\n A --> B\n```\n', 0)]);
  await page.locator('.diagram-canvas svg').waitFor();
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Read-only preview', exact: true }).click();
  const editStart = messages.filter(item => item.type === 'edit').length;
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Mermaid source').fill('flowchart LR\n Changed --> B');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.diagram-canvas')?.textContent?.includes('Changed'));
  observations.readOnlyDiagramEdit = { editsSent: messages.filter(item => item.type === 'edit').length - editStart, nodeLabels: await page.locator('.diagram-canvas .nodeLabel').allTextContents() };
  observations.pageErrors = pageErrors;
  await writeFile(resolve(out, 'ux-probe.json'), JSON.stringify({ timestamp: new Date().toISOString(), scope: 'Production webview in bundled headless Chromium, recorded host messages; no live VS Code integration', observations }, null, 2) + '\n');
  console.log(JSON.stringify(observations, null, 2));
} finally {
  await browser.close();
}
