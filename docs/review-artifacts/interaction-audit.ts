import { chromium, type Page } from 'playwright-core';
import { SourceRepository } from '../../src/document/sourceFile';
import { DocumentGraph } from '../../src/document/documentGraph';
import { serializeSource } from '../../src/document/serializer';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { createHash } from 'node:crypto';

const out=resolve('docs/review-artifacts/interaction');
const root='file:///C:/review/MASTER.md';
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const cases:Record<string,{language:string;code:string}>={
  'cpp-standard':{language:'cpp',code:'#include <vector>\n// 中文注释\nstd::vector<int> values = {1, 2, 3};\nint main() { return values[0]; }'},
  'cpp-simple':{language:'cpp',code:'// 中文注释\nint main() { return 42; }'},
  'c':{language:'c',code:'#include <stdio.h>\nint main(void) { printf("hello"); return 0; }'},
  'protobuf':{language:'protobuf',code:'syntax = "proto3";\npackage demo;\nmessage User {\n  string name = 1;\n  int32 id = 2;\n}\nservice UserService { rpc GetUser(User) returns (User); }'},
  'proto':{language:'proto',code:'syntax = "proto3";\nmessage Reply { string value = 1; }'},
  'protobuf-options':{language:'protobuf',code:'syntax = "proto3";\nmessage Reply { repeated int32 value = 1 [packed = true]; }'},
  'typescript':{language:'typescript',code:'interface User { name: string; }\nconst user: User = { name: "中文" };'},
  'typescript-generics':{language:'ts',code:'function first<T>(values: T[]): T { return values[0]; }'},
  'javascript-array':{language:'javascript',code:'const values = [1, 2, 3];\nconsole.log(values[0]);'},
  'python':{language:'python',code:'def greet(name):\n    # 中文注释\n    return f"Hello {name}"'},
  'python-array':{language:'python',code:'values = [1, 2, 3]\nprint(values[0])'},
  'json':{language:'json',code:'{ "name": "test", "enabled": true }'},
  'json-array':{language:'json',code:'{ "items": [1, 2, 3] }'},
  'yaml':{language:'yaml',code:'name: demo\nenabled: true\nitems:\n  - first\n  - second'},
  'bash':{language:'bash',code:'#!/bin/bash\necho "hello"\nif test -f file; then echo yes; fi'},
  'sql':{language:'sql',code:'SELECT id, name FROM users WHERE enabled = TRUE;'},
  'rust':{language:'rust',code:'fn first(values: Vec<i32>) { println!("{}", values[0]); }'},
  'java':{language:'java',code:'public class Main { public static void main(String[] args) { System.out.println("hello"); } }'},
  'csharp':{language:'csharp',code:'List<int> values = new List<int>();'},
  'go':{language:'go',code:'package main\nfunc main() { println("hello") }'},
  'xml':{language:'xml',code:'<root><item value="1">中文</item></root>'},
  'html':{language:'html',code:'<div class="card"><strong>Hello</strong></div>'},
  'css':{language:'css',code:'.card { color: red; padding: 16px; }'},
  'cmake':{language:'cmake',code:'cmake_minimum_required(VERSION 3.20)\nproject(Demo LANGUAGES CXX)\nadd_executable(demo main.cpp)'},
  'unknown':{language:'madeup-language',code:'example plain text & symbols'},
  'no-language':{language:'',code:'example plain text & symbols'},
};
const report:any={timestamp:new Date().toISOString(),scope:'Local production webview and production document model; controlled host adapter records edits, save, undo/redo and conflicts. Host-specific commands separately checked in real VS Code.',languages:[],inventory:[],actions:[],shortcuts:[],layout:[],errors:[]};
let browser:any,page:Page,repository:SourceRepository,graph:DocumentGraph,files:Record<string,string>,messages:any[],history:any[],redos:any[];
const fixture='# Interface\n\nAlpha bold words.\n\nSecond paragraph.\n\n- [ ] Task\n- [x] Done\n\n| A | B |\n| --- | --- |\n| One | Two |\n\n```ts\nconst value = 42;\n```\n\n```mermaid\nflowchart LR\n A --> B\n```\n';
async function load(text=fixture,width=1280){
  if(page)await page.close();page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(6000);
  messages=[];history=[];redos=[];files={[root]:text};
  repository=new SourceRepository({read:async uri=>files[uri],write:async(uri,text)=>{files[uri]=text;},resolve:async(from,path)=>new URL(path,from).href});graph=new DocumentGraph(repository,root);await graph.build();
  page.on('pageerror',error=>report.errors.push(String(error)));
  await page.exposeFunction('auditHost',async(message:any)=>{
    messages.push(message);try{
      if(message.type==='edit'){const changes=[{uri:message.uri,pieceId:message.pieceId,before:message.before,after:message.text}];repository.apply(changes,'after',true,message.origin);history.push(changes);redos=[];}
      if(message.type==='undo'){const change=history.pop();if(change){repository.apply(change,'before',false);redos.push(change);}}
      if(message.type==='redo'){const change=redos.pop();if(change){repository.apply(change,'after',false);history.push(change);}}
      if(message.type==='save')await repository.save(graph.sourceUris);
    }catch(error){report.errors.push(String(error));}
  });
  await page.exposeFunction('auditClipboard',(text:string)=>{messages.push({type:'clipboard-write',text});});
  repository.on('change',event=>{if(event.kind==='piece')void page.evaluate(message=>window.postMessage(message,'*'),{type:'patch',...event});});
  await page.setContent('<span id="status" role="status" class="sr-only"></span><nav id="toolbar"></nav><aside id="conflicts"></aside><div id="notice" hidden></div><main id="document"></main>');
  await page.evaluate('window.__name = value => value');
  await page.evaluate(()=>{(window as any).acquireVsCodeApi=()=>({postMessage:(message:any)=>(window as any).auditHost(message),getState:()=>({}),setState:()=>{}});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:(text:string)=>(window as any).auditClipboard(text)}});});
  await page.addStyleTag({path:resolve('dist/editor.css')});await page.addScriptTag({path:resolve('dist/mermaid-runtime.js')});await page.addScriptTag({path:resolve('dist/editor.js')});
  await page.evaluate(segments=>window.postMessage({type:'document',title:'Audit',segments},'*'),graph.segments.map(s=>({...s,resourceBase:'http://localhost/review'})));
  await page.locator('.segment').first().waitFor();
}
async function snapshot(){return {dom:await page.locator('#document').innerHTML(),text:serializeSource(repository.sources.get(root)!),active:await page.evaluate(()=>({tag:document.activeElement?.tagName,label:document.activeElement?.getAttribute('aria-label'),class:document.activeElement?.className,selection:window.getSelection()?.toString(),dialogs:[...document.querySelectorAll('dialog[open]')].map(el=>el.textContent),menu:!(document.querySelector('.insert-menu') as HTMLElement)?.hidden,bodyClass:document.body.className,rootStyle:document.querySelector('#document')?.getAttribute('style')})),messages:messages.map(m=>m.type)};}
async function activeParagraph(){await page.locator('.segment').filter({hasText:'Alpha bold words.'}).click();await page.locator('.ProseMirror').press('Control+Home');await page.keyboard.down('Shift');await page.keyboard.press('End');await page.keyboard.up('Shift');}
async function audit(name:string,fn:()=>Promise<any>){try{const detail=await fn();report.actions.push({name,...detail});}catch(error){report.actions.push({name,error:String(error)});}await writeFile(join(out,'audit.json'),JSON.stringify(report,null,2));}

async function main(){await mkdir(out,{recursive:true});const extras=process.argv.includes('--extras');if(extras)Object.assign(report,JSON.parse(await readFile(join(out,'audit.json'),'utf8')));browser=await chromium.launch({executablePath:resolve('engine/chrome-headless-shell.exe'),headless:true});try{
  if(!extras){
  for(const [name,sample] of Object.entries(cases)){
    const raw='```'+sample.language+'\n'+sample.code+'\n```\n';await load(raw);const initial=await page.locator('.segment').evaluate(el=>({raw:!!el.querySelector('.raw-preview'),code:!!el.querySelector('pre code'),tokens:el.querySelectorAll('[class*=hljs-]').length,display:el.querySelector('pre code')?.textContent??el.querySelector('pre')?.textContent,tools:[...el.querySelectorAll('button')].map(b=>b.getAttribute('aria-label'))}));
    await page.locator('.segment').click();const editor=page.locator('.ProseMirror, .raw-editor');await editor.waitFor();await editor.press('Control+End');await page.keyboard.type(' ');await page.keyboard.press('Control+s');await wait(20);
    const saved=files[root];report.languages.push({name,...sample,...initial,editor:await editor.getAttribute('class'),savedPreservesCode:saved.includes(sample.code),savedHash:createHash('sha256').update(saved).digest('hex')});
    if(['cpp-standard','cpp-simple','protobuf','protobuf-options','python-array','xml'].includes(name)){await load(raw);await page.screenshot({path:join(out,`language-${name}.png`)});}
  }
  console.log('LANGUAGE_MATRIX '+report.languages.map((x:any)=>`${x.name}:${x.raw?'RAW':x.tokens?'HIGHLIGHT':'PLAIN'}`).join(', '));
  await load();report.inventory=await page.locator('#toolbar > button').evaluateAll(buttons=>buttons.map((button:any)=>({label:button.getAttribute('aria-label'),title:button.title,disabled:button.disabled,pressed:button.getAttribute('aria-pressed'),shortcut:button.getAttribute('aria-keyshortcuts')})));
  const labels=report.inventory.map((x:any)=>x.label);
  for(const label of labels)for(const state of ['inactive','paragraph'])await audit(`Toolbar/${label}/${state}`,async()=>{
    await load();if(state==='paragraph')await activeParagraph();const before=await snapshot();const b=page.locator('#toolbar > button').filter({has:page.locator(`svg`)}).and(page.getByRole('button',{name:label,exact:true}));const disabled=await b.isDisabled();if(!disabled)await b.click();await wait(30);const after=await snapshot();return {state,disabled,before,after};
  });
  await load();await page.getByRole('button',{name:'Insert',exact:true}).click();const insertLabels=await page.locator('.insert-menu button').allTextContents();
  for(const label of insertLabels)for(const state of ['inactive','paragraph',...(label.toLowerCase().includes('table')?['table']:[])])await audit(`Insert/${label}/${state}`,async()=>{
    await load();if(state==='paragraph')await activeParagraph();if(state==='table')await page.getByText('One',{exact:true}).click();await page.getByRole('button',{name:'Insert',exact:true}).click();const before=await snapshot();const target=page.locator('.insert-menu button').filter({hasText:new RegExp('^'+label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')});const disabled=await target.isDisabled();if(!disabled)await target.click();await wait(30);return {state,disabled,before,after:await snapshot()};
  });
  await load();await page.getByRole('button',{name:'More',exact:true}).click();const moreLabels=await page.locator('dialog[open] button').allTextContents();
  for(const label of moreLabels)await audit(`More/${label}`,async()=>{await load();await activeParagraph();await page.getByRole('button',{name:'More',exact:true}).click();const before=await snapshot();await page.locator('dialog[open]').getByRole('button',{name:label,exact:true}).click();await wait(30);return {before,after:await snapshot()};});
  for(const [name,key] of [['Bold','Control+b'],['Italic','Control+i'],['Inline code','Control+`'],['Save','Control+s'],['Save As','Control+Shift+s'],['Undo','Control+z'],['Redo','Control+Shift+z'],['Redo Y','Control+y'],['Find','Control+f'],['Heading proposal','Control+Alt+1'],['Link proposal','Control+k']]){
    await load();await activeParagraph();await page.keyboard.type('changed');await page.locator('.ProseMirror').press('Control+Home');await page.keyboard.down('Shift');await page.keyboard.press('End');await page.keyboard.up('Shift');messages=[];await page.keyboard.press(key);await wait(30);report.shortcuts.push({name,key,after:await snapshot()});
  }
  await audit('Insert menu Escape and outside click',async()=>{await load();await page.getByRole('button',{name:'Insert',exact:true}).click();await page.keyboard.press('Escape');const afterEscape=await page.locator('.insert-menu').isVisible();await page.locator('h1').click();return {afterEscape,afterOutside:await page.locator('.insert-menu').isVisible()};});
  await audit('Dialog keyboard undo interference',async()=>{await load();await activeParagraph();await page.getByRole('button',{name:'Insert',exact:true}).click();await page.locator('.insert-menu').getByRole('button',{name:'Link',exact:true}).click();await page.getByLabel('Link text').fill('Typed value');messages=[];await page.getByLabel('Link text').press('Control+z');await wait(30);return {value:await page.getByLabel('Link text').inputValue(),messages};});
  await audit('Table insertion uses inline cells',async()=>{await load();await activeParagraph();await page.getByRole('button',{name:'Insert',exact:true}).click();await page.locator('.insert-menu').getByRole('button',{name:'Table',exact:true}).click();const inserted=await page.locator('.ProseMirror table').count();await page.getByRole('button',{name:'Insert',exact:true}).click();await page.locator('.insert-menu').getByRole('button',{name:'Add table row',exact:true}).click();return {inserted,rows:await page.locator('.ProseMirror table tr').count(),notice:await page.locator('#notice').textContent()};});
  for(const label of ['Copy','Wrap lines'])await audit(`Code/${label}`,async()=>{await load();const code=page.locator('.segment').filter({has:page.locator('pre code')}).first();const before=await code.textContent();await code.getByRole('button',{name:label,exact:true}).click();return {before,after:await code.innerHTML()};});
  for(const label of ['Copy','Edit','Zoom in','Zoom out','Fit diagram','Fullscreen','Export SVG','Export PNG'])await audit(`Diagram/${label}`,async()=>{await load();await page.locator('.diagram-canvas svg').waitFor();const figure=page.locator('.diagram-figure');const before=await figure.innerHTML();const downloads:any[]=[];page.on('download',d=>downloads.push(d.suggestedFilename()));await figure.getByRole('button',{name:label,exact:true}).click();await wait(120);return {before,after:await figure.innerHTML(),dialogs:await page.locator('dialog[open]').allTextContents(),downloads};});
  for(const choice of ['Preview','Export','Cancel'])await audit(`PDF/${choice}`,async()=>{await load();await page.getByRole('button',{name:'Export PDF',exact:true}).click();messages=[];await page.locator('dialog[open]').getByRole('button',{name:choice,exact:true}).click();return {messages,remainingDialogs:await page.locator('dialog').count()};});
  await audit('Diagram dialog Escape cleanup',async()=>{await load();await page.locator('.diagram-canvas svg').waitFor();await page.getByRole('button',{name:'Edit',exact:true}).click();await page.keyboard.press('Escape');return {openDialogs:await page.locator('dialog[open]').count(),allDialogs:await page.locator('dialog').count()};});
  }
  for(const label of ['List','Quote','Heading 1'])await audit(`Repeated formatting/${label}`,async()=>{await load();await activeParagraph();const b=page.locator('#toolbar').getByRole('button',{name:label,exact:true});await b.click();const first=await snapshot();await b.click();return {first,second:await snapshot(),pressed:await b.getAttribute('aria-pressed')};});
  await audit('Task checkbox mouse and keyboard',async()=>{await load();const task=page.locator('li[data-checked]').first();const box=await task.boundingBox();await page.mouse.click(box!.x-12,box!.y+box!.height/2);await wait(30);return {afterClick:serializeSource(repository.sources.get(root)!),role:await task.getAttribute('role'),tabIndex:await task.getAttribute('tabindex')};});
  for(const choice of ['reload','keep','diff'])await audit(`Conflict/${choice}`,async()=>{await load();await page.evaluate(uri=>window.postMessage({type:'status',dirty:[uri],conflicts:[{uri,deleted:false}]},'*'),root);messages=[];const labels:any={reload:'Reload external version',keep:'Keep editor version',diff:'View diff'};await page.getByRole('button',{name:labels[choice],exact:true}).click();return {messages};});
  for(const [label,key] of [['Bold','Control+b'],['Italic','Control+i'],['Code','Control+`']])await audit(`Shortcut with settled selection/${label}`,async()=>{await load();await activeParagraph();await wait(150);messages=[];const before=await snapshot();await page.locator('.ProseMirror').press(key);await wait(100);const after=await snapshot();await page.keyboard.type('X');await wait(50);return {before,after,typed:await snapshot(),platform:await page.evaluate(()=>navigator.platform)};});
  for(const type of ['Link','Image'])for(const action of ['Insert','Cancel','Escape'])await audit(`Dialog/${type}/${action}`,async()=>{await load();await activeParagraph();await page.getByRole('button',{name:'Insert',exact:true}).click();await page.locator('.insert-menu').getByRole('button',{name:type,exact:true}).click();await page.getByLabel(type==='Link'?'Link text':'Alt text').fill(type==='Link'?'Documentation':'Local picture');await page.getByLabel('URL / relative path').fill(type==='Link'?'https://example.org/':'./image.png');const before=await snapshot();if(action==='Escape')await page.keyboard.press('Escape');else await page.locator('dialog[open]').getByRole('button',{name:action,exact:true}).click();await wait(50);return {before,after:await snapshot()};});
  for(const action of ['Apply','Cancel'])await audit(`Diagram editor/${action}`,async()=>{await load();await page.locator('.diagram-canvas svg').waitFor();await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByLabel('Mermaid source').fill('flowchart LR\n Modified --> B');const before=serializeSource(repository.sources.get(root)!);await page.getByRole('button',{name:action,exact:true}).click();await wait(50);return {before,after:serializeSource(repository.sources.get(root)!),remainingDialogs:await page.locator('dialog').count()};});
  await audit('Diagram fullscreen Close',async()=>{await load();await page.locator('.diagram-canvas svg').waitFor();await page.locator('.diagram-figure').getByRole('button',{name:'Fullscreen',exact:true}).click();await page.locator('dialog[open]').getByRole('button',{name:'Close',exact:true}).click();return {remainingDialogs:await page.locator('dialog').count()};});
  await audit('PDF invalid margin Cancel',async()=>{await load();await page.getByRole('button',{name:'Export PDF',exact:true}).click();await page.locator('input[name=margin]').fill('100');await page.locator('dialog[open]').getByRole('button',{name:'Cancel',exact:true}).click();return {stillOpen:await page.locator('dialog[open]').count(),messages:messages.filter(m=>m.type==='export-pdf')};});
  if(!extras){for(const width of [320,400,600,900,1280]){
    await load(fixture,width);await activeParagraph();await page.getByRole('button',{name:'Insert',exact:true}).click();const layout=await page.evaluate(()=>{const box=(el:Element|null)=>{const r=el?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}:null;};return {viewport:{width:innerWidth,height:innerHeight},toolbar:box(document.querySelector('#toolbar')),toolbarScrollWidth:document.querySelector('#toolbar')?.scrollWidth,insertMenu:box(document.querySelector('.insert-menu')),visibleButtons:[...document.querySelectorAll('#toolbar > button')].filter(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}).map(el=>el.getAttribute('aria-label'))};});report.layout.push({width,...layout});await page.screenshot({path:join(out,`layout-${width}.png`)});
  }
  await load();await page.locator('.diagram-canvas svg').waitFor();await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('button',{name:'Light / dark theme',exact:true}).click();await page.screenshot({path:join(out,'manual-dark.png')});
  await load();await page.locator('.diagram-canvas svg').waitFor();await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('button',{name:'Read-only preview',exact:true}).click();await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByLabel('Mermaid source').fill('flowchart LR\n ReadonlyChanged --> B');messages=[];await page.getByRole('button',{name:'Apply',exact:true}).click();await wait(30);report.actions.push({name:'Read-only Mermaid Apply',messages});
  }
  await writeFile(join(out,'audit.json'),JSON.stringify(report,null,2));console.log('INTERACTION_AUDIT_FINISHED '+report.actions.length+' actions, '+report.languages.length+' language cases');
 }finally{await browser.close();}}
void main();
