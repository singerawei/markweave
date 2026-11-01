import * as vscode from 'vscode';
import { chromium } from 'playwright-core';
import { join,dirname,resolve } from 'node:path';
import { readFile,realpath,writeFile,rm,mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {markdownTokenizer} from '../shared/markdown';
import { randomUUID } from 'node:crypto';
import type { CompositeDocument } from './compositeDocument';

export interface PdfOptions {format:'A4'|'A3'|'Letter';landscape:boolean;margin:number;fontSize:number;header:string;footer:string;pageNumbers:boolean;headingBreak:boolean;preview?:boolean}
const escape = (text:string) => text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export async function exportPdf(document:CompositeDocument,extensionPath:string,options:PdfOptions) {
  if (!['A4','A3','Letter'].includes(options.format) || !Number.isFinite(options.margin) || options.margin<0 || options.margin>60 || !Number.isFinite(options.fontSize) || options.fontSize<8 || options.fontSize>32) throw new Error('Invalid PDF settings.');
  const destination = options.preview ? vscode.Uri.file(join(await mkdtemp(join(tmpdir(),'markdownup-pdf-')),'preview.pdf')) : await vscode.window.showSaveDialog({defaultUri:document.uri.with({path:document.uri.path.replace(/\.md$/i,'.pdf')}),filters:{PDF:['pdf']}});
  if (!destination) return;
  if(!destination.fsPath.toLowerCase().endsWith('.pdf'))throw new Error('The export destination must be a .pdf file.');
  // Snapshot the complete composition, including unsaved blocks, before launching Chromium.
  const segments = document.graph.segments.map(segment => ({...segment,text:document.repository.sources.get(segment.sourceUri)?.pieceById.get(segment.pieceId)?.raw ?? segment.text}));
  const broken = segments.find(segment => segment.error); if (broken) throw new Error(broken.error);
  const md = markdownTokenizer();
  let currentUri = '';
  const images:Promise<void>[] = [];
  md.renderer.rules.image = (tokens,index) => {
    const token = tokens[index], src = String(token.attrGet('src') ?? '');
    const id = randomUUID(); const owner = currentUri;
    images.push((async () => {
      if (/^[a-z][\w+.-]*:|^\/\/|^\\\\/i.test(src)) throw new Error(`Only local images can be exported: ${src}`);
      const path = await realpath(resolve(dirname(fileURLToPath(owner)),decodeURIComponent(src)));
      const roots = vscode.workspace.workspaceFolders?.map(folder => folder.uri.fsPath) ?? [dirname(document.uri.fsPath)];
      const allowed = await Promise.all(roots.map(root => realpath(root)));
      if (!allowed.some(root => path.toLowerCase().startsWith(root.toLowerCase()+'\\'))) throw new Error(`Image outside workspace: ${src}`);
      const type = path.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : path.toLowerCase().endsWith('.jpg') || path.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
      imageData.set(id,`data:${type};base64,${(await readFile(path)).toString('base64')}`);
    })());
    return `<img src="IMAGE-${id}" alt="${escape(token.content)}">`;
  };
  const imageData = new Map<string,string>();
  let body = segments.map(segment => { currentUri=segment.sourceUri; return md.render(segment.text); }).join('\n');
  await Promise.all(images); for (const [id,data] of imageData) body=body.replace(`IMAGE-${id}`,data);
  await vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:'Exporting PDF',cancellable:true},async (progress,token) => {
    const browser = await chromium.launch({executablePath:join(extensionPath,'engine','chrome-headless-shell.exe'),headless:true});
    const subscription = token.onCancellationRequested(() => { void browser.close(); });
    try {
      if (token.isCancellationRequested) throw new Error('Export cancelled.');
      const page = await browser.newPage(); await page.route('**/*',route => route.abort());
      await page.setContent(`<html><head><meta charset="utf-8"><style>body{font:${options.fontSize}px/1.65 'Segoe UI','Microsoft YaHei',sans-serif;color:#202630}img,svg{max-width:100%;height:auto}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f3f5f7;padding:12px;border-radius:6px}code{font-family:Consolas,monospace}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:6px}thead{display:table-header-group}tr,figure{break-inside:avoid}h1,h2,h3{break-after:avoid}h1{${options.headingBreak?'break-before:page':''}}h1:first-child{break-before:auto}svg{display:block;margin:auto}.hljs-keyword,.hljs-selector-tag{color:#7838a5}.hljs-string,.hljs-attr{color:#38721c}.hljs-number,.hljs-literal{color:#875000}.hljs-comment{color:#596575}.hljs-title,.hljs-type{color:#155e99}li[data-checked]{list-style:none}li[data-checked]::before{content:"[ ] ";}li[data-checked=true]::before{content:"[x] ";}</style></head><body>${body}</body></html>`);
      progress.report({message:'Rendering diagrams and images…'});
      await page.addScriptTag({path:join(extensionPath,'dist','mermaid-runtime.js')});
      await page.addScriptTag({path:join(extensionPath,'dist','export-renderer.js')});
      await page.evaluate(async () => { await (window as any).renderExport(); await window.document.fonts.ready; await Promise.all([...window.document.images].map(image => image.decode())); });
      if (token.isCancellationRequested) throw new Error('Export cancelled.');
      progress.report({message:'Writing PDF…'});
      const bytes = await page.pdf({format:options.format,landscape:options.landscape,printBackground:true,margin:{top:options.margin+'mm',bottom:options.margin+'mm',left:options.margin+'mm',right:options.margin+'mm'},displayHeaderFooter:!!options.header || !!options.footer || options.pageNumbers,headerTemplate:`<div style="font-size:9px;width:100%;text-align:center">${escape(options.header)}</div>`,footerTemplate:`<div style="font-size:9px;width:100%;text-align:center">${escape(options.footer)} ${options.pageNumbers?'<span class="pageNumber"></span> / <span class="totalPages"></span>':''}</div>`});
      if(token.isCancellationRequested)throw new Error('Export cancelled.');
      const temporary = destination.fsPath+'.'+randomUUID()+'.tmp';
      try { await writeFile(temporary,bytes); await vscode.workspace.fs.rename(vscode.Uri.file(temporary),destination,{overwrite:true}); }
      finally { await rm(temporary,{force:true}); }
      const action = options.preview ? 'Open PDF' : await vscode.window.showInformationMessage('PDF exported successfully.','Open PDF');
      if (action) await vscode.commands.executeCommand('vscode.open',destination);
    } finally { subscription.dispose(); await browser.close(); }
  });
  return destination;
}
