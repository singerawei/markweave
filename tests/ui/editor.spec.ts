import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import {readFileSync}from'node:fs';
import { SourceRepository } from '../../src/document/sourceFile';
import { DocumentGraph } from '../../src/document/documentGraph';
import type { PieceEdit } from '../../src/shared/types';
import { markdown } from '../../bench/generator';

async function launch(page:Page,files:Record<string,string>) {
  page.on('pageerror',error => process.stderr.write(`Webview error: ${String(error)}\n`));
  const writes:string[] = [], history:PieceEdit[][] = [], redos:PieceEdit[][] = [], errors:string[] = [];
  const sent:any[]=[];let clipboard='';
  const preferences:Record<string,unknown>={};
  const repository = new SourceRepository({
    read:async uri => { if (!(uri in files)) throw new Error('missing'); return files[uri]; },
    write:async (uri,text) => { files[uri] = text; writes.push(uri); },
    resolve:async (from,path) => new URL(path,from).href
  });
  const graph = new DocumentGraph(repository,'file:///C:/docs/MASTER.md'); await graph.build();
  await page.setContent('<header><strong>MarkWeave</strong><span id="title"></span><span id="status"></span><button id="save">保存</button></header><nav id="toolbar"></nav><aside id="conflicts"></aside><div id="notice" hidden></div><main id="document"></main><footer>本地 Markdown · 点击正文编辑 · Ctrl/Cmd+S 保存</footer>');
  const publish = (message:unknown) => page.evaluate(message => window.postMessage(message,'*'),message);
  repository.on('change',event => { if (event.kind === 'piece') void publish({type:'patch',...event});else if(event.kind==='pieces')void publish({type:'pieces',...event}); });
  await page.exposeFunction('host',async (message:any) => {
    sent.push(message);
    try {
      if(message.type==='copy'){clipboard=message.text;await publish({type:'result',id:message.id,result:true});return;}
      if(message.type==='preference'){preferences[message.key]=message.value;await publish({type:'preferences',preferences});return;}
      if (message.type === 'edit') {
        const changes = [{uri:message.uri,pieceId:message.pieceId,before:message.before,after:message.text}];
        repository.apply(changes,'after',true,message.origin); history.push(changes); redos.length = 0;
      } else if (message.type === 'save') await repository.save(graph.sourceUris);
      else if (message.type === 'undo') { const edits = history.pop(); if (edits) { repository.apply(edits,'before',false); redos.push(edits); } }
      else if (message.type === 'redo') { const edits = redos.pop(); if (edits) { repository.apply(edits,'after',false); history.push(edits); } }
    } catch (error) { errors.push(String(error)); }
  });
  await page.evaluate(() => {
    (window as any).acquireVsCodeApi = () => ({postMessage:(message:any) => (window as any).host(message),getState:() => ({}),setState:() => {}});
  });
  await page.addStyleTag({path:resolve('dist/editor.css')});
  await page.addScriptTag({path:resolve('dist/mermaid-runtime.js')});
  await page.addScriptTag({path:resolve('dist/editor.js')});
  const segments = graph.segments.map(s => ({...s,resourceBase:'http://localhost/docs'}));
  const tick = Date.now(); await publish({type:'document',title:'MASTER.md',segments:segments.slice(0,128)});
  await expect(page.locator('#document .segment').first()).toBeVisible();
  const openMs = Date.now()-tick;
  for (let i=128;i<segments.length;i+=512) await publish({type:'append',segments:segments.slice(i,i+512)});
  return {repository,graph,writes,files,errors,publish,openMs,sent,preferences,get clipboard(){return clipboard;}};
}
const root = 'file:///C:/docs/MASTER.md', child = 'file:///C:/docs/payment.md';

async function openOutline(page:Page){await page.keyboard.press('Control+Shift+O');await expect(page.locator('#navigation')).toBeVisible();}
async function bodyTarget(page:Page,text='Body text.'){await page.getByText(text,{exact:true}).click();await expect(page.locator('.ProseMirror')).toHaveCount(1);}

test('edit an included file, mirror duplicate, undo/redo, save only child, offline',async ({page}) => {
  await page.route('**/*',route => route.abort());
  const host = await launch(page,{[root]:'# Architecture\n\n@import "./payment.md"\n\n@import "./payment.md"\n',[child]:'# Payment\n\nStripe\n'});
  const original = host.files[root];
  await page.getByText('Stripe',{exact:true}).first().click();
  await page.locator('.ProseMirror').press('Control+End');
  await page.keyboard.type(' — Adyen',{delay:5});
  await expect(page.locator('.segment').filter({hasText:'Stripe — Adyen'})).toHaveCount(2);
  await expect.poll(() => host.errors).toEqual([]);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.ProseMirror')).toHaveText('Stripe — Adye');
  await page.keyboard.press('Control+Shift+z');
  await expect(page.locator('.ProseMirror')).toHaveText('Stripe — Adyen');
  await page.keyboard.press('Control+s');
  await expect.poll(() => host.writes).toEqual([child]);
  expect(host.files[root]).toBe(original); expect(host.files[child]).toContain('Stripe — Adyen');
  expect(await page.locator('.ProseMirror').count()).toBe(1);
  await mkdir('bench/results',{recursive:true}); await page.screenshot({path:'bench/results/editor.png',fullPage:true});
});
test('HTML stays visual, unsafe HTML is sanitized and tables remain editable',async ({page}) => {
  const host = await launch(page,{[root]:'# Architecture\n\nA **bold** paragraph.\n\n| A | B |\n| :--- | ---: |\n| One :white_check_mark: | Two |\n\n<script>window.PWNED=true</script>\n\n<kbd>Ctrl</kbd> and <mark>safe</mark>\n\n- [ ] Task\n- [x] Done\n'});
  await expect(page.locator('.table-scroll table')).toBeVisible();
  await mkdir('bench/results',{recursive:true});
  await page.screenshot({path:'bench/results/table-visual.png',fullPage:true});
  await page.getByText(/One/).first().click(); await expect(page.locator('.ProseMirror table')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByText('A bold paragraph.',{exact:true}).click();
  await page.locator('.ProseMirror').press('Control+End');
  await page.keyboard.press('Escape');
  await page.locator('.segment.source-notice').click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toContainText('Edit HTML block');
  await expect(dialog.locator('.block-editor-source')).toHaveValue(/window\.PWNED/);
  await expect(page.locator('.segment textarea')).toHaveCount(0);
  await dialog.getByRole('button',{name:'Cancel'}).click();
  expect(await page.evaluate(() => (window as any).PWNED)).toBeUndefined();
  await page.locator('.segment').filter({hasText:'Ctrl'}).click();
  await expect(page.locator('.html-visual-editor')).toHaveAttribute('contenteditable','true');
  await expect(page.locator('.segment textarea')).toHaveCount(0);
  await page.evaluate(()=>{
    const editor=document.querySelector<HTMLElement>('.html-visual-editor')!;
    const keyboard=editor.querySelector('kbd')!;
    editor.focus();
    const range=document.createRange();range.selectNodeContents(keyboard);range.collapse(false);
    const selection=getSelection()!;selection.removeAllRanges();selection.addRange(range);
  });
  await page.keyboard.type('!');
  await expect(page.locator('.html-visual-editor')).toContainText('Ctrl!');
  await page.getByRole('button',{name:'Done'}).click();
  await expect(page.locator('.html-visual-editor')).toHaveCount(0);
  await expect(page.locator('.segment kbd')).toHaveText('Ctrl!');
  await page.getByText('A bold paragraph.',{exact:true}).click();
  await page.locator('.ProseMirror').press('Control+End'); await page.keyboard.type(' safe');
  await page.keyboard.press('Control+s'); await expect.poll(() => host.writes.length).toBe(1);
  expect(host.files[root]).toContain('<script>window.PWNED=true</script>'); expect(host.files[root]).toContain('<kbd>Ctrl!</kbd>'); expect(host.errors).toEqual([]);
});

test('document and outline headings expose a clear hierarchy',async({page})=>{
  await launch(page,{[root]:'# Level one\n\n## Level two\n\n### Level three\n\n#### Level four\n\n##### Level five\n\n###### Level six\n\nBody text.\n'});
  const metrics=await page.evaluate(()=>{
    const headingSizes=Object.fromEntries(['h1','h2','h3','h4','h5','h6'].map(tag=>[tag,parseFloat(getComputedStyle(document.querySelector('#document '+tag)!).fontSize)]));
    return {headingSizes,body:parseFloat(getComputedStyle(document.querySelector('#document')!).fontSize),width:document.querySelector('#document')!.getBoundingClientRect().width};
  });
  expect(metrics.headingSizes.h1).toBeGreaterThan(metrics.headingSizes.h2);
  expect(metrics.headingSizes.h2).toBeGreaterThan(metrics.headingSizes.h3);
  expect(metrics.headingSizes.h3).toBeGreaterThan(metrics.headingSizes.h4);
  expect(metrics.headingSizes.h4).toBeGreaterThan(metrics.headingSizes.h5);
  expect(metrics.headingSizes.h5).toBeGreaterThanOrEqual(metrics.headingSizes.h6);
  for(const size of Object.values(metrics.headingSizes)) expect(size).toBeGreaterThanOrEqual(metrics.body);
  expect(metrics.width).toBeGreaterThan(1000);
  await mkdir('bench/results',{recursive:true});
  await page.screenshot({path:'bench/results/typography.png',fullPage:true});
  await openOutline(page);
  const levels=await page.locator('#navigation .navigation-result').evaluateAll(items=>items.map(item=>({level:item.getAttribute('data-level'),size:parseFloat(getComputedStyle(item).fontSize),badge:getComputedStyle(item,'::before').content,current:item.getAttribute('aria-current')})));
  expect(levels.map(item=>item.level)).toEqual(['1','2','3','4','5','6']);
  expect(levels[0].size).toBeGreaterThan(levels[2].size);
  expect(levels[5].size).toBeLessThan(levels[2].size);
  expect(levels.every(item=>item.badge.includes('H'))).toBe(true);
  expect(levels.filter(item=>item.current==='location')).toHaveLength(1);
  await page.screenshot({path:'bench/results/outline-hierarchy.png',fullPage:false});
});

test('complex rendered blocks open a visual editor instead of inline raw text',async({page})=>{
  await launch(page,{[root]:'# Architecture\n\n> [!NOTE]\n> Alert body.\n\n!!! tip "Hint"\n    Tip body.\n\nTerm\n: Definition\n\nText[^1].\n\n[^1]: Footnote body.\n\n[ref]: https://example.com\n\n<span>styled</span>\n'});
  const selectors=['blockquote.md-alert','.admonition','dl','.footnote-def','.reference-defs'];
  for(const selector of selectors){
    await page.locator(selector).first().click();
    await expect(page.locator('.block-editor-dialog')).toBeVisible();
    await expect(page.locator('.segment textarea')).toHaveCount(0);
    await expect(page.locator('.block-editor-preview')).toBeVisible();
    await page.locator('.block-editor-dialog').getByRole('button',{name:'Cancel'}).click();
  }
});
test('large document lazy rendering: bounded editor count and measured input P95',async ({page}) => {
  const host = await launch(page,{[root]:markdown(5*1024*1024)});
  const total = host.graph.segments.length; const rendered = await page.locator('[data-rendered=true]').count();
  expect(rendered).toBeLessThan(200);
  await page.getByText('Local-first design',{exact:false}).first().click();
  await page.locator('.ProseMirror').press('Control+End');
  const timings:number[] = [];
  for (let i=0;i<30;i++) {
    const elapsed = await page.evaluate(async () => {
      const start = performance.now();
      document.execCommand('insertText',false,'a');
      await new Promise(requestAnimationFrame); return performance.now()-start;
    }); timings.push(elapsed);
  }
  timings.sort((a,b) => a-b);
  const report = {scope:'Headless Chromium webview harness; excludes extension activation and VS Code IPC',sizeMB:5,openMs:host.openMs,totalSegments:total,initialRenderedSegments:rendered,inputP95Ms:timings[Math.floor(timings.length*.95)]};
  await writeFile('bench/results/ui.json',JSON.stringify(report,null,2)+'\n');
  expect(await page.locator('.ProseMirror').count()).toBe(1); expect(host.errors).toEqual([]);
  expect(report.inputP95Ms).toBeLessThanOrEqual(50);
});
test('insert links and code without leaving the visual editor',async ({page}) => {
  const host = await launch(page,{[root]:'# Architecture\n\nAdd here.\n'});
  await page.getByText('Add here.',{exact:true}).click(); await page.locator('.ProseMirror').press('Control+End');
  await page.getByRole('button',{name:'Insert',exact:true}).click(); await page.getByRole('button',{name:'Link',exact:true}).click();
  await page.getByLabel('Link text').fill('Documentation'); await page.getByLabel('URL / relative path').fill('https://example.org/docs');
  await page.getByRole('button',{name:'Insert',exact:true}).last().click();
  await expect(page.locator('.ProseMirror a')).toHaveText('Documentation');
  await page.keyboard.press('Control+s'); await expect.poll(() => host.writes.length).toBe(1);
  expect(host.files[root]).toContain('[Documentation](https://example.org/docs)');
  await page.getByRole('button',{name:'Insert',exact:true}).click(); await page.getByRole('button',{name:'Code block',exact:true}).click();
  await expect(page.locator('.ProseMirror pre')).toBeVisible();
  await page.keyboard.press('Control+s'); await expect.poll(() => host.writes.length).toBe(2);
  expect(host.files[root]).toContain('```'); expect(host.errors).toEqual([]);
});
test('icons, Mermaid editing, outline and export options',async({page})=>{
  const host=await launch(page,{[root]:'# Architecture\n\n```mermaid\nflowchart LR\n A[Start] --> B[End]\n```\n\n```js\nconst value = 1;\n```\n'});
  await expect(page.locator('header')).toHaveCount(0);
  await expect(page.locator('#source-status')).toHaveCount(0);
  await expect(page.locator('#toolbar')).toHaveCSS('height','42px');
  await expect(page.locator('#toolbar > button').first()).toHaveAttribute('aria-label','Bold');
  await expect(page.locator('.diagram-canvas svg').first()).toBeVisible();
  await expect(page.locator('.hljs-keyword')).toHaveText('const');
  await page.getByRole('button',{name:'Diagram actions',exact:true}).click();
  await page.getByRole('button',{name:'Edit',exact:true}).click();
  await page.getByLabel('Mermaid source').fill('flowchart LR\n A[Updated] --> B[End]');
  await page.getByRole('button',{name:'Apply'}).click();
  await expect(page.locator('.diagram-canvas')).toContainText('Updated');
  await page.screenshot({path:'bench/results/mermaid-ui.png',fullPage:true});
  await page.keyboard.press('Control+s');await expect.poll(()=>host.files[root]).toContain('Updated');
  await openOutline(page);await expect(page.locator('#navigation')).toContainText('Architecture');
  await page.getByRole('tab',{name:'Find'}).click();await expect(page.getByLabel('Find in document')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#navigation')).toBeHidden();
  await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('button',{name:'Export PDF',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Page numbers');
});
test('find updates when offscreen metadata arrives',async({page})=>{
  const host=await launch(page,{[root]:'# Architecture\n\nVisible text.\n'});
  await page.keyboard.press('Control+f');await page.getByLabel('Find in document').fill('Late arrival');
  await host.publish({type:'append',segments:[{id:'late:p0',pieceId:'p0',sourceUri:child,sourceFile:'child.md',includeInstanceId:'late',sourceVersion:1,text:'Late arrival\n',editable:true}]});
  await expect(page.locator('#navigation .navigation-result')).toContainText('Late arrival');
});
test('native dialog history, Save As routing, invalid PDF cancellation and Esc cleanup',async({page})=>{
  const host=await launch(page,{[root]:'# Architecture\n\nBody text.\n'});await bodyTarget(page);await page.locator('.ProseMirror').press('Control+End');await page.keyboard.type(' edited');const before=page.locator('.ProseMirror');
  await page.keyboard.press('Control+Shift+s');await expect.poll(()=>host.sent.filter(message=>message.type==='save-as').length).toBe(1);expect(host.writes).toEqual([]);
  for(let i=0;i<20;i++){await page.getByRole('button',{name:'Insert',exact:true}).click();await page.getByRole('button',{name:'Link',exact:true}).click();const input=page.getByLabel('Link text');await input.fill('local');await input.press('End');await input.press('x');await input.press('Control+z');await expect(before).toContainText('edited');await page.getByRole('dialog').press('Escape');await expect(page.locator('dialog')).toHaveCount(0);}
  expect(host.sent.filter(message=>message.type==='undo')).toHaveLength(0);
  await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('button',{name:'Export PDF',exact:true}).click();await page.getByLabel('Margin (mm)').fill('100');await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.locator('dialog')).toHaveCount(0);expect(host.sent.filter(message=>message.type==='export-pdf')).toHaveLength(0);
});
test('read-only blocks diagram editing and copies through the host',async({page})=>{
  const host=await launch(page,{[root]:'# Architecture\n\n```mermaid\nflowchart LR\n A --> B\n```\n'});await expect(page.locator('.diagram-canvas svg')).toBeVisible();
  await page.getByRole('button',{name:'Diagram actions',exact:true}).click();await page.getByRole('button',{name:'Copy source',exact:true}).click();await expect.poll(()=>host.clipboard).toContain('flowchart LR');
  await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('button',{name:'Read-only preview',exact:true}).click();
  await page.getByRole('button',{name:'Diagram actions',exact:true}).click();await expect(page.getByRole('button',{name:'Edit',exact:true})).toBeDisabled();
  await expect(page.locator('#source-status')).toHaveCount(0);expect(host.sent.filter(message=>message.type==='edit')).toHaveLength(0);
});
test('all 26 review samples render as code; aliases and editing keys work',async({page})=>{
  const literal=readFileSync('docs/review-artifacts/interaction-audit.ts','utf8').match(/const cases:[^\r\n]*=({[\s\S]*?});\s*const report/)![1];const samples=Function('return ('+literal+')')()as Record<string,{language:string;code:string}>;
  const host=await launch(page,{[root]:'# Architecture\n\n'+Object.values(samples).map(sample=>'```'+sample.language+'\n'+sample.code+'\n```\n\n').join('')});await expect(page.locator('.raw-preview')).toHaveCount(0);await expect(page.locator('pre > code')).toHaveCount(26);expect(await page.locator('.hljs-keyword').count()).toBeGreaterThan(15);await mkdir('docs/review-artifacts/response-2.1.0/ui',{recursive:true});for(const [index,name]of Object.keys(samples).entries()){const block=page.locator('pre').nth(index);await block.scrollIntoViewIfNeeded();await block.screenshot({path:'docs/review-artifacts/response-2.1.0/ui/code-'+name.replace(/[^a-z0-9-]/gi,'_')+'.png'});}
  const code=page.locator('pre > code').first();await code.click();await expect(page.locator('.editing-code select')).toHaveValue('cpp');await expect(page.locator('.ProseMirror .hljs-keyword').first()).toBeVisible();await page.locator('.ProseMirror').press('Control+Home');await page.keyboard.press('Tab');await expect.poll(()=>host.repository.sources.get(root)!.pieces.some(piece=>piece.raw.includes('  #include'))).toBe(true);await page.keyboard.press('Shift+Tab');await page.locator('.editing-code select').selectOption('protobuf');await expect.poll(()=>host.files[root]).toContain('Architecture');await page.keyboard.press('Control+s');await expect.poll(()=>host.files[root]).toContain('```protobuf');
});
test('30k navigation hits stay bounded and panel switches do not hide it',async({page})=>{
  await launch(page,{[root]:'# Architecture\n\n'+Array.from({length:30000},(_,i)=>'## Chapter '+i+'\n\nLocal content '+i+'\n\n').join('')});
  await page.keyboard.press('Control+f');await page.getByLabel('Find in document').fill('Local');await expect(page.locator('#navigation')).toContainText('30000 matches');expect(await page.locator('#navigation button').count()).toBeLessThanOrEqual(100);
  await page.getByLabel('Find in document').fill('no-match-word');await expect(page.locator('#navigation')).toContainText('0 matches');for(let i=0;i<20;i++){await page.getByRole('tab',{name:i%2?'Outline':'Find'}).click();await expect(page.locator('#navigation')).toBeVisible();}await page.keyboard.press('Escape');await expect(page.locator('#navigation')).toBeHidden();
});
test('320 to 1280px menus fit, close and preserve required actions',async({page})=>{
  await launch(page,{[root]:'# Architecture\n\nBody text.\n'});await bodyTarget(page);for(const zoom of [1,2])for(const width of [320,400,600,900,1280]){await page.setViewportSize({width,height:900});await page.evaluate(zoom=>document.body.style.zoom=String(zoom),zoom);await bodyTarget(page);await page.getByRole('button',{name:'Insert',exact:true}).click();const menu=page.locator('.insert-menu[role=menu]').filter({visible:true});const bounds=await menu.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width);await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);const overflow=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,innerWidth,body:document.body.scrollWidth,toolbar:document.querySelector('#toolbar')!.scrollWidth,toolbarWidth:document.querySelector('#toolbar')!.clientWidth}));expect(overflow.scrollWidth<=overflow.innerWidth,`overflow at ${width}px / ${zoom}x: ${JSON.stringify(overflow)}`).toBe(true);await page.setViewportSize({width:1280,height:900});await page.evaluate(()=>document.body.style.zoom='1');}
});
test('oversized blocks expose a safe native-editor fallback',async({page})=>{
  const text='# Architecture\n\n```cpp\n'+('int a[1];\n'.repeat(150000))+'```\n';const host=await launch(page,{[root]:text});await expect(page.getByRole('button',{name:'Edit in Text Editor'})).toBeVisible();expect((await page.locator('#document').textContent())!.length).toBeLessThan(6000);await page.getByRole('button',{name:'Edit in Text Editor'}).click();expect(host.sent.some(message=>message.type==='reveal')).toBe(true);expect(host.files[root]).toBe(text);expect(host.sent.filter(message=>message.type==='edit')).toHaveLength(0);
});
test('local paragraph joins and undo update repeated sources without rebuilding',async({page})=>{
  const host=await launch(page,{[root]:'# Architecture\n\n@import "./payment.md"\n\n@import "./payment.md"\n',[child]:'One\n\nTwo\n'});
  await page.getByText('Two',{exact:true}).first().click();
  const source=host.repository.sources.get(child)!,before=source.pieces.slice(),hash=host.repository.fingerprint(child);
  const after=[{...before[0],raw:'OneTwo\n'}];host.repository.editPieces(child,hash,after);
  await expect(page.locator('.segment').filter({hasText:'OneTwo'})).toHaveCount(2);
  host.repository.editPieces(child,host.repository.fingerprint(child),before);
  await expect(page.getByText('Two',{exact:true})).toHaveCount(2);await expect(page.getByText('One',{exact:true})).toHaveCount(2);
  await page.keyboard.press('Control+f');await page.getByLabel('Find in document').fill('Two');await expect(page.locator('#navigation')).toContainText('2 matches');expect(host.errors).toEqual([]);
});
test('high contrast chrome stays readable and the status bar is gone',async({page})=>{
  const host=await launch(page,{[root]:'# Architecture\n\nBody text.\n\n```mermaid\nflowchart LR\n A --> B\n```\n'});
  await expect(page.locator('#source-status')).toHaveCount(0);
  await page.evaluate(()=>{document.body.className='vscode-high-contrast';document.body.style.cssText='--vscode-editor-background:#000;--vscode-foreground:#fff';});
  await page.keyboard.press('Control+Shift+O');await expect(page.locator('#navigation')).toBeVisible();
  await expect(page.locator('#navigation [aria-current=location]')).toHaveCount(1);
  const current=await page.locator('#navigation [aria-current=location]').evaluate(element=>{const style=getComputedStyle(element);return {fontWeight:style.fontWeight,background:style.backgroundColor,color:style.color};});
  expect(current.fontWeight).toBe('700');expect(current.background).not.toBe('rgba(0, 0, 0, 0)');expect(current.color).not.toBe('rgba(0, 0, 0, 0)');
  await host.publish({type:'error',message:'High contrast failure'});
  await expect(page.locator('#notice .toast.error')).toContainText('High contrast failure');
  await expect(page.locator('#notice .toast button').filter({hasText:'Details'})).toBeVisible();
  await page.locator('#notice .toast button').filter({hasText:'Details'}).click();
  await expect(page.getByRole('dialog')).toContainText('High contrast failure');
});

test('extended Markdown renders safely with resolvable references and TOC',async({page})=>{
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
  await page.route('https://example.com/remote.png',route=>route.fulfill({status:200,contentType:'image/png',body:png}));
  const text=[
    '---','title: Demo','tags: [a, b]','---','',
    '# Heading One','','## Heading Two','',
    '[TOC]','',
    '[go](#heading-two) and [reference][ref].','',
    '[ref]: https://example.com "Reference title"','',
    'Angle <https://example.com/angle> and bare https://example.com/bare.','',
    '> [!NOTE]','> Alert body.','',
    '> [!TIP] Custom title','> Tip body.','',
    '!!! warning "Careful"','    Admonition body.','',
    'Term',': Definition','',
    'Inline math $e^{i\\pi}+1=0$.','',
    '$$','\\int_0^1 x^2 dx','$$','',
    '==highlight== H~2~O x^2^ :smile:','',
    'Footnotes[^1].','','[^1]: Note body.','',
    '[[Wiki Page]] and ![[Embed]]. Percent %%hidden comment%% here.','',
    '%%','block hidden','%%','',
    'API is an abbreviation.','','*[API]: Application Programming Interface','',
    '<kbd>Ctrl</kbd> and <mark>safe</mark> and <details><summary>More</summary>Hidden</details>','',
    '<script>window.PWNED=true</script>','',
    '![remote](https://example.com/remote.png)',''
  ].join('\n');
  await launch(page,{[root]:text});
  await expect(page.locator('.frontmatter-card')).toContainText('Demo');
  await expect(page.locator('.md-toc')).toContainText('Heading Two');
  await expect(page.locator('blockquote.md-alert-note')).toContainText('Alert body');
  await expect(page.locator('blockquote.md-alert-tip')).toHaveAttribute('data-title','Custom title');
  await expect(page.locator('.admonition')).toContainText('Admonition body');
  await expect(page.locator('dl dt').filter({hasText:'Term'})).toHaveCount(1);
  await expect(page.locator('.katex math')).toHaveCount(2);
  await expect(page.locator('mark').filter({hasText:'highlight'})).toBeVisible();
  await expect(page.locator('sub')).toHaveText('2');
  await expect(page.locator('sup:not(.footnote-ref)')).toHaveText('2');
  await expect(page.locator('.footnote-ref')).toContainText('1');
  await expect(page.locator('.footnote-def')).toContainText('Note body');
  await expect(page.locator('.md-wikilink')).toContainText('Wiki Page');
  await expect(page.locator('.md-embed')).toContainText('Embed');
  await expect(page.locator('.md-comment')).toHaveCount(1);
  await expect(page.locator('.md-comment-block')).toHaveCount(1);
  await expect(page.locator('abbr[title="Application Programming Interface"]')).toHaveText('API');
  await expect(page.locator('#document kbd')).toHaveText('Ctrl');
  await expect(page.locator('mark').filter({hasText:'safe'})).toBeVisible();
  await expect(page.locator('details summary')).toHaveText('More');
  await expect(page.locator('a[href="https://example.com"]').filter({hasText:'reference'})).toBeVisible();
  await expect(page.locator('a[href="https://example.com/bare"]')).toBeVisible();
  const remote=page.locator('img[src="https://example.com/remote.png"]');
  await expect(remote).toBeVisible();
  expect(await remote.evaluate(image=>(image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>(window as any).PWNED)).toBeUndefined();

  await page.getByRole('link',{name:'go',exact:true}).click();
  await page.waitForTimeout(180);
  const headingTop=await page.evaluate(()=>document.getElementById('heading-two')?.getBoundingClientRect().top);
  expect(headingTop).toBeGreaterThanOrEqual(38);
  await page.locator('.md-toc a').filter({hasText:'Heading Two'}).click();
  await page.waitForTimeout(180);
  expect(await page.evaluate(()=>Math.abs((document.getElementById('heading-two')?.getBoundingClientRect().top??0)-document.querySelector('#toolbar')!.getBoundingClientRect().bottom))).toBeLessThanOrEqual(4);

  await page.locator('.math-block').click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toContainText('Edit math block');
  const source=dialog.locator('.block-editor-source');
  await expect(source).toHaveValue(/\\int_0\^1/);
  await expect(page.locator('.segment textarea')).toHaveCount(0);
  await dialog.getByRole('button',{name:'Cancel'}).click();
  await expect(page.locator('.math-block')).toBeVisible();
  await expect(page.locator('.ProseMirror')).toHaveCount(0);
});

test('navigation follows scroll with one aria-current and aligns the clicked heading',async({page})=>{
  const sections=Array.from({length:100},(_,i)=>`## Heading ${i}\n\n${'Paragraph line.\n\n'.repeat(20)}`).join('');
  await launch(page,{[root]:`# Architecture\n\n${sections}`});
  await page.keyboard.press('Control+f');
  await page.getByLabel('Find in document').fill('Heading 50');
  await expect(page.locator('#navigation .navigation-result')).toHaveCount(1);
  await page.locator('#navigation .navigation-result').click();
  await page.waitForTimeout(180);
  await openOutline(page);
  await expect(page.locator('#navigation [aria-current=location]')).toHaveCount(1);
  await expect(page.locator('#navigation [aria-current=location]')).toHaveText('Heading 50');
  const results=page.locator('#navigation .navigation-results');
  const openedAt=await page.evaluate(()=>window.scrollY);
  await page.waitForTimeout(150);
  expect(Math.abs((await page.evaluate(()=>window.scrollY))-openedAt)).toBeLessThanOrEqual(4);
  const nextHeading=await page.evaluate(()=>{
    const segment=[...document.querySelectorAll('.segment')].find(element=>element.textContent?.trim().startsWith('Heading 51'));
    if(!segment)return null;
    const heading=segment.querySelector('h1,h2,h3,h4,h5,h6')??segment;
    return heading.getBoundingClientRect().top-document.querySelector('#toolbar')!.getBoundingClientRect().bottom;
  });
  expect(nextHeading).not.toBeNull();
  await page.evaluate(delta=>window.scrollBy(0,Number(delta)+1),nextHeading);
  await page.waitForTimeout(180);
  await expect(page.locator('#navigation [aria-current=location]')).toHaveCount(1);
  await expect(page.locator('#navigation [aria-current=location]')).toHaveText('Heading 51');
  const bodyBeforeJump=await page.evaluate(()=>window.scrollY);
  await page.locator('#navigation .navigation-result').filter({hasText:/^Heading 70$/}).click();
  await page.waitForTimeout(760);
  const alignment=await page.evaluate(()=>{const segment=[...document.querySelectorAll('.segment')].find(element=>element.textContent?.trim().startsWith('Heading 70'));const heading=segment?.querySelector('h1,h2,h3,h4,h5,h6')??segment;const toolbar=document.querySelector('#toolbar')!;return {top:heading!.getBoundingClientRect().top,bottom:toolbar.getBoundingClientRect().bottom};});
  expect(Math.abs(alignment.top-alignment.bottom)).toBeLessThanOrEqual(4);
  const afterJump=await page.evaluate(()=>window.scrollY);
  expect(afterJump).not.toBe(bodyBeforeJump);
  await openOutline(page);
  await expect(page.locator('#navigation [aria-current=location]')).toHaveText('Heading 70');
  await expect(page.locator('#navigation [aria-current=location]')).toHaveCount(1);
  await page.waitForTimeout(120);
  expect(await results.evaluate(element=>element.scrollTop)).toBeGreaterThan(0);
  expect(Math.abs((await page.evaluate(()=>window.scrollY))-afterJump)).toBeLessThanOrEqual(4);
});

test('navigation pin survives Escape and persistence messages; focus returns to the editor',async({page})=>{
  const host=await launch(page,{[root]:'# Architecture\n\nBody text.\n\n## Second\n\nMore text.\n'});
  await bodyTarget(page);
  await page.getByRole('button',{name:'Navigate',exact:true}).click();
  await expect(page.locator('#navigation')).toBeVisible();
  await page.getByRole('button',{name:/Pin navigation/}).click();
  await expect(page.getByRole('button',{name:/Unpin navigation/})).toHaveAttribute('aria-pressed','true');
  await expect.poll(()=>host.preferences.navigationPinned).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#navigation')).toBeVisible();
  await page.getByRole('button',{name:'Close navigation'}).click();
  await expect(page.locator('#navigation')).toBeHidden();
  await page.getByRole('button',{name:'Navigate',exact:true}).click();
  await expect(page.locator('#navigation')).toBeVisible();
  await page.getByRole('button',{name:/Unpin navigation/}).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#navigation')).toBeHidden();
  await expect.poll(()=>host.preferences.navigationPinned).toBe(false);
  await expect(page.locator('.ProseMirror')).toBeFocused();
});

test('toolbar has at most eight controls, no duplicate More actions and hides/reappears',async({page})=>{
  const host=await launch(page,{[root]:'# Architecture\n\nBody text.\n'});
  expect(await page.locator('#toolbar > *').count()).toBeLessThanOrEqual(8);
  await page.getByRole('button',{name:'More',exact:true}).click();
  const more=page.locator('.more-menu');
  expect(await more.locator(':scope > button').count()).toBeLessThanOrEqual(10);
  const primary=await page.locator('#toolbar > button').evaluateAll(buttons=>buttons.map(button=>button.getAttribute('aria-label')));
  const secondary=await more.locator(':scope > button').allTextContents();
  expect(secondary.filter(label=>primary.includes(label))).toEqual([]);
  await more.getByRole('button',{name:'Hide toolbar',exact:true}).click();
  await expect(page.locator('#toolbar')).toBeHidden();
  await expect(page.getByRole('button',{name:'Show toolbar'})).toBeVisible();
  await expect.poll(()=>host.preferences.toolbarHidden).toBe(true);
  await page.keyboard.press('Control+Alt+t');
  await expect(page.locator('#toolbar')).toBeVisible();
  await expect.poll(()=>host.preferences.toolbarHidden).toBe(false);
});

test('insert is disabled without a target and supports Home/End/Escape with focus return',async({page})=>{
  await launch(page,{[root]:'# Architecture\n\nBody text.\n'});
  const insert=page.getByRole('button',{name:'Insert',exact:true});
  await expect(insert).toBeDisabled();
  await expect(page.locator('.insert-menu[role=menu]:not([hidden])')).toHaveCount(0);
  await bodyTarget(page);
  await expect(insert).toBeEnabled();
  await insert.click();
  const menu=page.locator('.insert-menu[role=menu]').filter({visible:true});
  await expect(menu).toBeVisible();
  await page.keyboard.press('End');
  await expect(menu.getByRole('button',{name:'Insert paragraph after'})).toBeFocused();
  await page.keyboard.press('Home');
  await expect(menu.getByRole('button',{name:'Ordered list'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(page.locator('.ProseMirror')).toBeFocused();
});

test('keyboard-only navigation, toolbar, insert and save cycles keep focus',async({page})=>{
  const host=await launch(page,{[root]:'# Architecture\n\nBody text.\n'});
  await bodyTarget(page);
  await page.locator('.ProseMirror').press('Control+End');
  await page.keyboard.type('x');
  await page.keyboard.press('Control+s');
  await expect.poll(()=>host.writes.length).toBe(1);
  for(let i=0;i<20;i++){
    await page.keyboard.press('Control+Shift+O');
    await expect(page.locator('#navigation')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#navigation')).toBeHidden();
    await expect(page.locator('.ProseMirror')).toBeFocused();
    await page.keyboard.press('Control+Alt+t');
    await expect(page.locator('#toolbar')).toBeHidden();
    await page.waitForTimeout(50);
    await page.keyboard.press('Control+Alt+t');
    await expect(page.locator('#toolbar')).toBeVisible();
    await page.keyboard.press('Control+Alt+i');
    await expect(page.locator('.insert-menu[role=menu]').filter({visible:true})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.insert-menu[role=menu]:not([hidden])')).toHaveCount(0);
    await expect(page.locator('.ProseMirror')).toBeFocused();
  }
  await page.keyboard.press('Control+s');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});

test('success toast does not shift layout and disappears without Dismiss',async({page})=>{
  const host=await launch(page,{[root]:'# Architecture\n\nBody text.\n\n```mermaid\nflowchart LR\n A --> B\n```\n'});
  await expect(page.locator('.diagram-canvas svg')).toBeVisible();
  const before=await page.evaluate(()=>({height:document.querySelector('#document')!.scrollHeight,scroll:window.scrollY,toolbar:document.querySelector('#toolbar')!.getBoundingClientRect().height}));
  await page.getByRole('button',{name:'Diagram actions',exact:true}).click();
  await page.getByRole('button',{name:'Copy source',exact:true}).click();
  await expect(page.locator('#notice .toast.success')).toContainText('Copied');
  await expect(page.locator('#notice .toast button').filter({hasText:'Dismiss'})).toHaveCount(0);
  const after=await page.evaluate(()=>({height:document.querySelector('#document')!.scrollHeight,scroll:window.scrollY,toolbar:document.querySelector('#toolbar')!.getBoundingClientRect().height}));
  expect(after).toEqual(before);
  expect(host.clipboard).toContain('flowchart LR');
  await expect(page.locator('#notice .toast')).toHaveCount(0,{timeout:4500});
});

test('navigation is an overlay at every width and never moves the document',async({page})=>{
  await launch(page,{[root]:'# Architecture\n\n'+Array.from({length:40},(_,i)=>`Paragraph ${i}.\n\n`).join('')});
  for(const width of [320,400,600,900]){
    for(const zoom of width===320||width===900?[1,2]:[1]){
      await page.setViewportSize({width,height:760});
      await page.evaluate(value=>{document.body.style.zoom=String(value);window.scrollTo(0,500);},zoom);
      const before=await page.evaluate(()=>window.scrollY);
      await openOutline(page);
      const panel=page.locator('#navigation');
      const box=await panel.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(-1);expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);
      const after=await page.evaluate(()=>window.scrollY);
      expect(Math.abs(after-before)).toBeLessThanOrEqual(4);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.getByRole('button',{name:'Close navigation'}).click();
      await expect(panel).toBeHidden();
      await page.evaluate(()=>document.body.style.zoom='1');
    }
  }
});

test('focus mode hides chrome without losing the edit position',async({page})=>{
  await launch(page,{[root]:'# Architecture\n\nBody text.\n\n'+Array.from({length:40},(_,i)=>`Paragraph ${i}.\n\n`).join('')});
  await bodyTarget(page);
  await page.evaluate(()=>window.scrollTo(0,600));
  const before=await page.evaluate(()=>{const element=[...document.querySelectorAll<HTMLElement>('.segment')].find(item=>item.getBoundingClientRect().top>100)!;return {id:element.dataset.id!,top:element.getBoundingClientRect().top};});
  const topOf=(id:string)=>page.evaluate(id=>{const element=[...document.querySelectorAll<HTMLElement>('.segment')].find(item=>item.dataset.id===id);return element?.getBoundingClientRect().top??null;},id);
  await page.keyboard.press('Control+Alt+f');
  await expect(page.locator('#toolbar')).toBeHidden();
  await expect(page.getByRole('button',{name:'Exit focus mode'})).toBeVisible();
  expect(Math.abs((await topOf(before.id))!-before.top)).toBeLessThanOrEqual(4);
  await page.getByRole('button',{name:'Exit focus mode'}).click();
  await expect(page.locator('#toolbar')).toBeVisible();
  await expect(page.getByRole('button',{name:'Exit focus mode'})).toBeHidden();
  await expect(page.locator('.ProseMirror')).toBeFocused();
  expect(Math.abs((await topOf(before.id))!-before.top)).toBeLessThanOrEqual(4);
});

test('Mermaid keeps one entry and code blocks keep two direct controls',async({page})=>{
  await launch(page,{[root]:'# Architecture\n\n```mermaid\nflowchart LR\n A --> B\n```\n\n```js\nconst value = 1;\n```\n'});
  await expect(page.locator('.diagram-figure .block-tools > button')).toHaveCount(1);
  await expect(page.locator('pre .block-tools > button')).toHaveCount(1);
  await expect(page.locator('pre .block-tools > select')).toHaveCount(1);
  await page.getByRole('button',{name:'Code actions',exact:true}).click();
  await expect(page.getByRole('button',{name:'Copy code',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Wrap lines',exact:true})).toBeVisible();
});
