import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdtemp,mkdir,writeFile,readFile,copyFile } from 'node:fs/promises';
import { tmpdir,cpus,totalmem,release } from 'node:os';
import { join,resolve } from 'node:path';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';

const out=resolve('docs/review-artifacts/response-0.3/live');await mkdir(out,{recursive:true});
await copyFile('bench/results/vscode.json',join(out,'existing-host-suite.json'));
const runRoot=await mkdtemp(join(tmpdir(),'markweave-live-review-'));
const workspace=join(runRoot,'workspace');await mkdir(workspace);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const report=process.argv.includes('--resume')?JSON.parse(await readFile(join(out,'performance.json'),'utf8')):{timestamp:new Date().toISOString(),hardware:{cpu:cpus()[0].model,logicalCPUs:cpus().length,ramGiB:totalmem()/2**30,os:release(),node:process.version},bundleHash:createHash('sha256').update(await readFile('dist/editor.js')).digest('hex'),workspace,scope:'Real local VS Code extension development host; production bundle; CDP keyboard and mouse input; no CPU throttling. Open request excludes application boot. Three repetitions for core cases; stress cases once.',opens:[],interactions:[],errors:[]};
report.fixtureRoots=[...new Set([...(report.fixtureRoots??[report.workspace]),workspace])];
const block=i=>`## Chapter ${i}\n\nLocal ownership text ${i} with **bold** and ordinary words to edit.\n\n- alpha\n- beta\n\n| A | B |\n| --- | --- |\n| one | two |\n\n\`\`\`ts\nconst value${i} = 42;\n\`\`\`\n\n`;
const documentOf=bytes=>{let items=[],size=0,i=0;while(size<bytes){const text=block(i++);items.push(text);size+=Buffer.byteLength(text);}return '# Review document\n\n'+items.join('');};
const fixtures={};
async function fixture(name,text){await writeFile(join(workspace,name),text);fixtures[name]={bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')};}
await fixture('single-1MB.md',documentOf(1024**2));await fixture('single-5MB.md',documentOf(5*1024**2));
for(const count of [100,500]){const folder=join(workspace,`includes-${count}`);await mkdir(folder);for(let i=0;i<count;i++)await writeFile(join(folder,`p${i}.md`),documentOf(Math.ceil(5*1024**2/count)));await fixture(`includes-${count}.md`,'# Composite\n\n'+Array.from({length:count},(_,i)=>`@import "./includes-${count}/p${i}.md"\n\n`).join(''));}
const graph=(index,nodes=3)=>'flowchart LR\n'+Array.from({length:nodes-1},(_,i)=>` N${i}[Node ${index}-${i}] --> N${i+1}[Node ${index}-${i+1}]`).join('\n');
await fixture('mermaid-20.md','# Twenty diagrams\n\n'+Array.from({length:20},(_,i)=>'```mermaid\n'+graph(i)+'\n```\n\n').join(''));
await fixture('mermaid-complex.md','# Complex diagram\n\n```mermaid\n'+graph('complex',150)+'\n```\n');
await fixture('mixed-5MB-100-diagrams.md','# Mixed\n\n'+Array.from({length:100},(_,i)=>'```mermaid\n'+graph('mixed'+i)+'\n```\n\n'+documentOf(Math.ceil(5*1024**2/100))).join(''));
for(const bytes of [100*1024,1024**2]){let text='',i=0;while(Buffer.byteLength(text)<bytes)text+=`const item${i++} = "syntax highlighting"; // source ownership\n`;await fixture(`code-${bytes}.md`,'# Large code\n\n```ts\n'+text+'```\n');}
await fixture('paragraph-100KB.md','# Large paragraph\n\n'+'ordinary words and 中文内容 '.repeat(4000)+'\n');
await fixture('table-1000rows.md','# Large table\n\n| A | B | C |\n| --- | --- | --- |\n'+Array.from({length:1000},(_,i)=>`| Row ${i} | **Data** | value ${i} |\n`).join(''));
await fixture('ui.md','# UI review\n\nAlpha **bold** and italic words.\n\nSecond paragraph.\n\n- [ ] Task\n- [x] Done\n\n| A | B |\n| --- | --- |\n| One | Two |\n\n```ts\nconst value = 42;\n```\n\n```mermaid\nflowchart LR\n A --> B\n```\n\nSetext title\n------------\n');
await fixture('cpp.md','# C++\n\n```cpp\n#include <vector>\nstd::vector<int> values;\n```\n');
await writeFile(join(out,'fixtures.json'),JSON.stringify(fixtures,null,2));

async function freePort(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
async function startHost(round){
 const directory=join(runRoot,`session-${round}`);await mkdir(join(directory,'profile','User'),{recursive:true});
 await writeFile(join(directory,'profile','User','settings.json'),JSON.stringify({'telemetry.telemetryLevel':'off','update.mode':'none','extensions.autoCheckUpdates':false,'extensions.autoUpdate':false,'workbench.startupEditor':'none','security.workspace.trust.enabled':false,'window.restoreWindows':'none','workbench.colorTheme':'Default Light Modern','window.zoomLevel':0}));
 const ready=join(directory,'ready.json'),port=await freePort();const env={...process.env,MARKWEAVE_REVIEW_READY:ready};delete env.ELECTRON_RUN_AS_NODE;
 let development=resolve('.');
 if(process.env.MARKWEAVE_TEST_VSIX){
   const {execFileSync}=await import('node:child_process');const {readdir,writeFile,mkdir}=await import('node:fs/promises');const {existsSync}=await import('node:fs');
   const base=join(process.env.LOCALAPPDATA,'Programs','Microsoft VS Code');const cli=(await readdir(base)).map(name=>join(base,name,'resources','app','out','cli.js')).find(existsSync);
   execFileSync(join(base,'Code.exe'),[cli,'--extensions-dir='+join(directory,'extensions'),'--user-data-dir='+join(directory,'profile'),'--install-extension',resolve(process.env.MARKWEAVE_TEST_VSIX)],{windowsHide:true,env:{...env,ELECTRON_RUN_AS_NODE:'1'},stdio:'pipe'});
   development=join(directory,'probe');await mkdir(development);await writeFile(join(development,'package.json'),JSON.stringify({name:'review-probe',publisher:'test',version:'0.0.1',engines:{vscode:'*'}}));
 }
 const child=spawn(join(process.env.LOCALAPPDATA,'Programs','Microsoft VS Code','Code.exe'),['--no-sandbox',...(process.env.MARKWEAVE_TEST_VSIX?[]:['--disable-extensions']),'--skip-welcome','--skip-release-notes','--disable-workspace-trust',`--user-data-dir=${join(directory,'profile')}`,`--extensions-dir=${join(directory,'extensions')}`,`--extensionDevelopmentPath=${development}`,`--extensionTestsPath=${resolve('scripts/review-bridge.cjs')}`,`--remote-debugging-port=${port}`,workspace],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 let log='';child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);
 let config;for(let i=0;i<300;i++){try{config=JSON.parse(await readFile(ready,'utf8'));break;}catch{}if(child.exitCode!==null)throw Error('Host exited: '+log.slice(-2000));await wait(100);}
 if(!config)throw Error('Host not ready: '+log.slice(-2000));
 const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);const context=browser.contexts()[0];
 await context.addInitScript(()=>{
   window.__review={longTasks:[],events:[],diagrams:[],createdAt:Date.now()};
   try{new PerformanceObserver(list=>window.__review.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});}catch{}
   document.addEventListener('keydown',event=>{if(event.target?.closest?.('.ProseMirror, .raw-editor')){const start=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>window.__review.events.push({key:event.key,ms:performance.now()-start})));}},true);
   window.addEventListener('diagram-rendered',()=>window.__review.diagrams.push({at:Date.now(),count:document.querySelectorAll('.diagram-canvas svg').length}));
 });
 const page=context.pages().find(p=>p.url().includes('workbench'))??context.pages()[0];
 const api=async(route,input={})=>{const response=await fetch(`http://127.0.0.1:${config.port}/${route}`,{method:'POST',body:JSON.stringify(input)});const data=await response.json();if(!response.ok)throw Error(JSON.stringify(data));return data;};
 async function frame(){for(let i=0;i<300;i++){for(const p of context.pages())for(const f of p.frames()){try{if(await f.locator('#document').count())return f;}catch{}}await wait(50);}throw Error('Webview frame not found');}
 async function close(){try{await api('close');await api('quit');}catch{}await Promise.race([new Promise(r=>child.once('exit',r)),wait(8000)]);if(child.exitCode===null)child.kill();await browser.close().catch(()=>{});child.stdout.destroy();child.stderr.destroy();child.unref();await writeFile(join(out,`host-${round}.log`),log);}
 return {api,page,context,frame,close};
}
function stats(values){const a=values.slice().sort((a,b)=>a-b);return {n:a.length,min:a[0],median:a[Math.floor(a.length/2)],p95:a[Math.min(a.length-1,Math.ceil(a.length*.95)-1)],max:a.at(-1)};}
async function inputMeasure(host,frame,selector,count=80){
 const element=frame.locator(selector).first();const started=Date.now();await element.click({timeout:30000});await frame.locator('.ProseMirror, .raw-editor').first().waitFor();
 const activateMs=Date.now()-started;await host.page.keyboard.press('Control+End');
 await frame.evaluate(()=>{window.__review.events=[];window.__review.longTasks=[];if(!window.__review.inputObserverInstalled){window.__review.inputObserverInstalled=true;document.addEventListener('keydown',event=>{if(event.target?.closest?.('.ProseMirror, .raw-editor')){const start=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>window.__review.events.push({key:event.key,ms:performance.now()-start})));}},true);}});
 await host.page.keyboard.type('abcdefghijklmnopqrstuvwxyz'.repeat(Math.ceil(count/26)).slice(0,count),{delay:15});await wait(250);
 return {activationMs:activateMs,...await frame.evaluate(()=>({events:window.__review.events,longTasks:window.__review.longTasks,editorCount:document.querySelectorAll('.ProseMirror').length}))};
}
async function measure(host,file,round,stress=false){
 await host.api('close');const opened=await host.api('open',{file});const f=await host.frame();
 let metrics;for(let i=0;i<600;i++){metrics=(await host.api('metrics')).documents.find(d=>d.file.toLowerCase()===opened.file.toLowerCase());if(metrics?.metrics.editable!==undefined)break;await wait(50);}
 if(metrics?.metrics.editable===undefined)throw Error('Editable timeout '+file);
 const row={...metrics,file,round,openRequestOverheadMs:metrics.openedAt-opened.startedAt};
 await wait(200);
 const expectedChunks=Math.ceil(metrics.segments/32);let fullIndexAt;
 for(let i=0;i<300;i++){if(await f.locator('#document > .chunk').count()>=expectedChunks){fullIndexAt=Date.now();break;}await wait(50);}
 row.fullIndexMs=fullIndexAt?fullIndexAt-opened.startedAt:null;
 if(file.includes('mermaid')||file.includes('mixed')){
   const deadline=Date.now()+45000;while(Date.now()<deadline){const state=await f.evaluate(()=>({count:document.querySelectorAll('.diagram-canvas svg').length,pending:[...document.querySelectorAll('.diagram-canvas')].filter(el=>el.textContent.includes('Rendering diagram')).length,error:[...document.querySelectorAll('.diagram-canvas')].filter(el=>el.textContent.includes('Diagram error')).map(el=>el.textContent.slice(0,300))}));row.renderState=state;if(state.pending===0){row.visibleDiagramsReadyMs=Date.now()-opened.startedAt;break;}await wait(100);}
 }
 row.hostMetricsAfterRender=(await host.api('metrics')).documents.find(d=>d.file.toLowerCase()===opened.file.toLowerCase())?.metrics;
 row.diagramTimeline=await f.evaluate(()=>window.__review.diagrams);
 row.dom=await f.evaluate(()=>({elements:document.querySelectorAll('*').length,segments:document.querySelectorAll('.segment').length,chunks:document.querySelectorAll('.chunk').length,scrollHeight:document.documentElement.scrollHeight,codeTokens:document.querySelectorAll('.hljs-keyword').length,rawBlocks:document.querySelectorAll('.raw-preview').length}));
 row.openLongTasks=await f.evaluate(()=>window.__review?.longTasks??[]);
 if(stress&&!file.includes('mermaid')){const sel=file.startsWith('code-')?'#document .segment:has(pre)':file.startsWith('table-')?'#document .segment:has(table)':'#document .segment:has(> p)';row.input=await inputMeasure(host,f,sel,40);}
 else if(!file.includes('mermaid'))row.input=await inputMeasure(host,f,'#document .segment:has(> p)',100);
 if(row.input){row.input.summary=stats(row.input.events.filter(e=>e.key.length===1).map(e=>e.ms));row.save=await host.api('save');}
 await f.evaluate(()=>{window.__review.longTasks=[];window.__review.scrollFrames=[];let last;window.__review.rafActive=true;function tick(t){if(!window.__review.rafActive)return;if(last!==undefined)window.__review.scrollFrames.push(t-last);last=t;requestAnimationFrame(tick);}requestAnimationFrame(tick);});
 for(let i=0;i<20;i++){await host.page.mouse.move(900,650);await host.page.mouse.wheel(0,650);await wait(40);}
 await wait(250);row.scroll=await f.evaluate(()=>{window.__review.rafActive=false;return {frames:window.__review.scrollFrames,longTasks:window.__review.longTasks,scrollY,segments:document.querySelectorAll('.segment').length};});row.scroll.summary=stats(row.scroll.frames);
 if(round===1)await host.page.screenshot({path:join(out,file.replace(/[^a-z0-9]/gi,'_')+'.png')});
 report.opens.push(row);await writeFile(join(out,'performance.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({file,round,readableMs:row.metrics.readable,editableMs:row.metrics.editable,visibleDiagramsReadyMs:row.visibleDiagramsReadyMs,fullIndexMs:row.fullIndexMs,input:row.input?.summary,scroll:row.scroll.summary,longestOpenTask:Math.max(0,...row.openLongTasks.map(t=>t.duration))}));
}

export {startHost,stats,inputMeasure,workspace,out,report,wait};
const already=(file,round)=>report.opens.some(row=>row.round===round&&(row.file===file||row.file.replaceAll('\\','/').endsWith('/'+file)));
if(process.env.MARKWEAVE_LIVE_HELPER!=='1'){
for(let round=1;round<=3;round++){
 let host;try{host=await startHost(round);report.vscode=(await host.api('metrics')).vscode;console.log('LIVE_HOST_READY round='+round);
   for(const file of ['mermaid-20.md','single-1MB.md','single-5MB.md','includes-100.md','includes-500.md']){if(already(file,round))continue;try{await measure(host,file,round);}catch(error){report.errors.push({file,round,error:String(error)});console.log('CASE_ERROR '+file+' '+error);}}
   if(round===1)for(const file of ['mixed-5MB-100-diagrams.md','mermaid-complex.md','code-102400.md','code-1048576.md','paragraph-100KB.md','table-1000rows.md']){if(already(file,round))continue;try{await measure(host,file,round,true);}catch(error){report.errors.push({file,round,error:String(error)});console.log('CASE_ERROR '+file+' '+error);}}
 }finally{if(host)await host.close();await writeFile(join(out,'performance.json'),JSON.stringify(report,null,2));}
}
console.log('LIVE_PERFORMANCE_FINISHED '+join(out,'performance.json'));
}
