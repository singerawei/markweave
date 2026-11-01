import {writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
process.env.MARKDOWNUP_LIVE_HELPER='1';
const {startHost,workspace,out,inputMeasure,stats,wait}=await import('./live-review.mjs');
let host;const result={timestamp:new Date().toISOString(),scope:'Real VS Code: keyboard input while uncached Mermaid queue is running; 5 MB common/absent find and large outline. One diagnostic run, not stable release statistics.'};
try{
 host=await startHost('concurrent');
 const diagrams=Array.from({length:20},(_,i)=>'```mermaid\nflowchart LR\n A[Concurrent '+i+'] --> B[Done '+i+']\n```\n\n').join('');await writeFile(join(workspace,'mermaid-typing.md'),'# Concurrent rendering\n\nEditable paragraph while diagrams render.\n\n'+diagrams);
 async function open(file){await host.api('close');await host.api('open',{file});const f=await host.frame();for(let i=0;i<400;i++){if((await host.api('metrics')).documents[0]?.metrics.editable!==undefined)break;await wait(50);}return f;}
 let f=await open('mermaid-typing.md');const state=()=>f.evaluate(()=>({complete:document.querySelectorAll('.diagram-canvas svg').length,pending:[...document.querySelectorAll('.diagram-canvas')].filter(e=>e.textContent.includes('Rendering diagram')).length}));const before=await state();const input=await inputMeasure(host,f,'.segment:has(> p)',120);const after=await state();result.concurrent={before,after,activationMs:input.activationMs,summary:stats(input.events.filter(e=>e.key.length===1).map(e=>e.ms)),longTasks:input.longTasks,events:input.events};
 await host.page.screenshot({path:join(out,'typing-during-diagrams.png')});
 f=await open('single-5MB.md');const expected=Math.ceil((await host.api('metrics')).documents[0].segments/32);await f.waitForFunction(n=>document.querySelectorAll('.chunk').length>=n,expected,{timeout:30000});
 await f.locator('#toolbar').getByRole('button',{name:'Find',exact:true}).click();
 result.search=[];
 for(const query of ['Local','zzq_not_present']){await f.evaluate(()=>{window.__review.longTasks=[];window.__searchStart=performance.now();window.__searchFinished=undefined;window.__searchObserver?.disconnect();window.__searchObserver=new MutationObserver(()=>{requestAnimationFrame(()=>requestAnimationFrame(()=>{window.__searchFinished=performance.now()-window.__searchStart;}));});window.__searchObserver.observe(document.querySelector('#navigation'),{childList:true,subtree:true});});await f.getByLabel('Find in document').fill(query);await wait(1000);let duration=await f.evaluate(()=>window.__searchFinished);if(duration===undefined)await wait(1000);result.search.push({query,...await f.evaluate(()=>({durationMs:window.__searchFinished??performance.now()-window.__searchStart,buttons:document.querySelectorAll('#navigation button').length,longTasks:window.__review.longTasks,domElements:document.querySelectorAll('*').length}))});}
 await f.evaluate(()=>{window.__review.longTasks=[];});const start=Date.now();await f.locator('#toolbar').getByRole('button',{name:'Outline',exact:true}).click();await f.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));result.outline={toTwoFramesMs:Date.now()-start,...await f.evaluate(()=>({buttons:document.querySelectorAll('#navigation button').length,hidden:document.querySelector('#navigation').hidden,longTasks:window.__review.longTasks}))};
 await writeFile(join(out,'concurrent.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,concurrent:{...result.concurrent,events:undefined}},null,2));
}finally{if(host)await host.close();}
