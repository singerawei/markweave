import * as vscode from 'vscode';
import { chromium } from 'playwright-core';
import { join,dirname,resolve } from 'node:path';
import { readFile,realpath,writeFile,rm,mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {markdownTokenizer,collectReferences,collectAbbreviations,type MarkdownEnv} from '../shared/markdown';
import {tocFromSegments} from '../shared/headings';
import {frontmatterHtml,isFrontmatter} from '../shared/frontmatter';
import { randomUUID } from 'node:crypto';
import type { CompositeDocument } from './compositeDocument';

export interface PdfOptions {format:'A4'|'A3'|'Letter';landscape:boolean;margin:number;fontSize:number;header:string;footer:string;pageNumbers:boolean;headingBreak:boolean;preview?:boolean}
const escape = (text:string) => text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export async function exportPdf(document:CompositeDocument,extensionPath:string,options:PdfOptions) {
  if (!['A4','A3','Letter'].includes(options.format) || !Number.isFinite(options.margin) || options.margin<0 || options.margin>60 || !Number.isFinite(options.fontSize) || options.fontSize<8 || options.fontSize>32) throw new Error('Invalid PDF settings.');
  const destination = options.preview ? vscode.Uri.file(join(await mkdtemp(join(tmpdir(),'markweave-pdf-')),'preview.pdf')) : await vscode.window.showSaveDialog({defaultUri:document.uri.with({path:document.uri.path.replace(/\.md$/i,'.pdf')}),filters:{PDF:['pdf']}});
  if (!destination) return;
  if(!destination.fsPath.toLowerCase().endsWith('.pdf'))throw new Error('The export destination must be a .pdf file.');
  // Snapshot the complete composition, including unsaved blocks, before launching Chromium.
  const segments = document.graph.segments.map(segment => ({...segment,text:document.repository.sources.get(segment.sourceUri)?.pieceById.get(segment.pieceId)?.raw ?? segment.text}));
  const broken = segments.find(segment => segment.error); if (broken) throw new Error(broken.error);
  const md = markdownTokenizer(true);
  const env: MarkdownEnv = {
    references: collectReferences(segments.map(segment => segment.text)),
    abbreviations: collectAbbreviations(segments.map(segment => segment.text)),
    toc: tocFromSegments(segments)
  };
  let currentUri = '';
  const images:Promise<void>[] = [];
  md.renderer.rules.image = (tokens,index) => {
    const token = tokens[index], src = String(token.attrGet('src') ?? '');
    const id = randomUUID(); const owner = currentUri;
    if (/^https?:\/\//i.test(src)) {
      images.push((async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
          const response = await fetch(src,{signal:controller.signal});
          if (!response.ok) throw new Error(`Remote image returned ${response.status}: ${src}`);
          const bytes = Buffer.from(await response.arrayBuffer());
          if (bytes.length > 20 * 1024 * 1024) throw new Error(`Remote image is larger than 20 MB: ${src}`);
          imageData.set(id,`data:${response.headers.get('content-type') || 'image/png'};base64,${bytes.toString('base64')}`);
        } finally { clearTimeout(timeout); }
      })());
      return `<img src="IMAGE-${id}" alt="${escape(token.content)}">`;
    }
    images.push((async () => {
      if (/^[a-z][\w+.-]*:|^\/\/|^\\\\/i.test(src)) throw new Error(`Unsupported image source: ${src}`);
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
  let body = segments.map((segment,index) => {
    currentUri = segment.sourceUri;
    if (index === 0 && isFrontmatter(segment.text)) return frontmatterHtml(segment.text);
    return `<section id="segment-${escape(segment.id)}">${md.render(segment.text,env)}</section>`;
  }).join('\n');
  await Promise.all(images); for (const [id,data] of imageData) body=body.replace(`IMAGE-${id}`,data);
  await vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:'Exporting PDF',cancellable:true},async (progress,token) => {
    const browser = await chromium.launch({executablePath:join(extensionPath,'engine','chrome-headless-shell.exe'),headless:true});
    const subscription = token.onCancellationRequested(() => { void browser.close(); });
    try {
      if (token.isCancellationRequested) throw new Error('Export cancelled.');
      const page = await browser.newPage(); await page.route('**/*',route => route.abort());
      await page.setContent(`<html><head><meta charset="utf-8"><style>body{font:${options.fontSize}px/1.75 'Segoe UI','Microsoft YaHei UI','PingFang SC',sans-serif;color:#202630}h1,h2,h3,h4,h5,h6{line-height:1.28;color:#1f2a36;break-after:avoid}h1{font-size:2em;border-bottom:1px solid #d8dee6;padding-bottom:.25em;margin:1.3em 0 .6em}h2{font-size:1.5em;border-bottom:1px solid #e2e7ed;padding-bottom:.2em;margin:1.3em 0 .55em}h3{font-size:1.25em;margin:1.2em 0 .5em}h4{font-size:1.12em}h5{font-size:1.04em}h6{font-size:.96em;text-transform:uppercase;letter-spacing:.05em;color:#657383}p{margin:.45em 0 1em}blockquote{margin:1em 0;padding:.6em 1em;border-left:4px solid #5c8f7d;background:#f4f8f6;border-radius:0 6px 6px 0}a{color:#1f5f99;text-decoration:none}img,svg{max-width:100%;height:auto}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f7f9;border:1px solid #d8dee6;padding:12px 14px;border-radius:8px;font-size:.86em;line-height:1.6}code{font-family:Consolas,'Cascadia Code',monospace}pre code{background:transparent;border:0;padding:0}:not(pre)>code{background:#f1f4f7;border:1px solid #e2e7ed;border-radius:3px;padding:.1em .3em}table{border-collapse:collapse;width:100%;font-size:.94em;line-height:1.55}td,th{border:1px solid #d8dee6;padding:8px 11px;text-align:left;vertical-align:top}th{background:#eef2f5;font-weight:700}tr:nth-child(even) td{background:#f8fafb}thead{display:table-header-group}tr,figure{break-inside:avoid}h1{${options.headingBreak?'break-before:page':''}}h1:first-child{break-before:auto}svg{display:block;margin:auto}.hljs-keyword,.hljs-selector-tag,.hljs-section{color:#cf222e;font-weight:600}.hljs-string,.hljs-attr{color:#0a3069}.hljs-number,.hljs-literal,.hljs-variable{color:#0550ae}.hljs-comment,.hljs-quote{color:#6e7781;font-style:italic}.hljs-title,.hljs-function,.hljs-title.function_{color:#8250df}.hljs-type,.hljs-built_in,.hljs-class .hljs-title{color:#953800}.hljs-meta,.hljs-symbol,.hljs-bullet{color:#116329}.hljs-operator,.hljs-punctuation{color:#57606a}li[data-checked]{list-style:none}li[data-checked]::before{content:"[ ] ";}li[data-checked=true]::before{content:"[x] ";}mark{background:#fff2a8;color:inherit}dl dt{font-weight:700}dl dd{margin:0 0 8px 24px}.md-alert{margin:12px 0;padding:10px 14px;border-left:4px solid #2f6fb3;background:#f2f7fc;border-radius:4px}.md-alert::before{content:attr(data-title);display:block;font-weight:700;margin-bottom:4px}.md-alert-warning,.md-alert-caution{border-left-color:#c77700;background:#fff7e8}.md-alert-important{border-left-color:#8a3ffc;background:#f7f2ff}.md-alert-tip,.md-alert-success{border-left-color:#2e7d32;background:#f1f8f1}.md-alert-danger,.md-alert-bug{border-left-color:#c62828;background:#fdf0f0}.admonition{margin:12px 0;padding:10px 14px;border:1px solid #ccd5df;border-radius:6px;background:#f7f9fb}.admonition-title{font-weight:700;margin-bottom:6px}.math-block{margin:12px 0;overflow:auto;text-align:center}.md-toc{margin:12px 0;padding:10px 14px;border:1px solid #d5dbe2;border-radius:6px;background:#f8fafc}.md-toc-title{font-weight:700;margin-bottom:6px}.md-toc ul{list-style:none;padding-left:0;margin:0}.md-toc li{margin:2px 0}.md-toc-level-2{padding-left:16px}.md-toc-level-3,.md-toc-level-4,.md-toc-level-5,.md-toc-level-6{padding-left:30px}.footnote-def{border-top:1px solid #ccd5df;margin-top:8px;padding-top:6px;font-size:.9em}.footnote-label{font-weight:700;margin-right:6px}.frontmatter-card{margin:0 0 18px;padding:12px 16px;border:1px solid #ccd5df;border-radius:6px;background:#f8fafc}.frontmatter-title{font-weight:700;margin-bottom:6px}.frontmatter-card dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 12px}.frontmatter-card dt{font-weight:700}.frontmatter-card dd{margin:0}.md-comment,.md-comment-block{display:none}.md-wikilink{text-decoration:underline}.md-embed{display:inline-block;padding:1px 6px;border:1px dashed #8aa0b5;border-radius:4px;color:#375d80}.md-toc a,.md-wikilink{color:#1f5f99}</style></head><body>${body}</body></html>`);
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
