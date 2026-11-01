import{writeFile,readFile}from'node:fs/promises';
import{join}from'node:path';
import{createHash}from'node:crypto';
process.env.MARKDOWNUP_LIVE_HELPER='1';
const{startHost,workspace,out,wait,inputMeasure}=await import('./review-host.mjs');
const results={timestamp:new Date().toISOString(),installed:!!process.env.MARKDOWNUP_TEST_VSIX,version:JSON.parse(await readFile('package.json','utf8')).version,sha256:createHash('sha256').update(await readFile('dist/editor.js')).digest('hex'),measurements:[],checks:[],errors:[]};
let host;
async function open(file){await host.api('close');const request=await host.api('open',{file});for(let i=0;i<400;i++){const doc=(await host.api('metrics')).documents.find(doc=>doc.file.toLowerCase()===request.file.toLowerCase());if(doc?.metrics.editable!==undefined)return {frame:await host.frame(),request,doc};await wait(50);}throw Error('Open timeout '+file);}
try{
 host=await startHost('candidate');
 const identity=await host.api('metrics');results.buildHashes=identity.buildHashes;results.extensionVersion=identity.extensionVersion;if(process.env.MARKDOWNUP_TEST_VSIX)results.vsixSha256=createHash('sha256').update(await readFile(process.env.MARKDOWNUP_TEST_VSIX)).digest('hex');
 for(const mode of ['cold','cached']){const{frame,request,doc}=await open('mermaid-20.md');await frame.locator('.diagram-canvas svg').nth(19).waitFor({state:'attached',timeout:30000});const metric=(await host.api('metrics')).documents.find(item=>item.file===doc.file);results.measurements.push({case:'20-diagrams',mode,firstMs:metric.metrics.diagram,allMs:Date.now()-request.startedAt,count:await frame.locator('.diagram-canvas svg').count()});}
 for(const file of ['single-1MB.md','single-5MB.md','includes-100.md','includes-500.md','code-102400.md','code-1048576.md','paragraph-100KB.md','table-1000rows.md']){
   const{frame,doc}=await open(file);const fallback=await frame.getByRole('button',{name:'Edit in Text Editor',exact:true}).count();let input;
   if(!fallback){input=await inputMeasure(host,frame,file.startsWith('code-')?'#document .segment:has(pre)':'#document .segment:has(> p)',100);}
   results.measurements.push({case:file,metrics:doc.metrics,fallback,input});await writeFile(join(out,'candidate.json'),JSON.stringify(results,null,2));
 }
 const{frame}=await open('single-5MB.md');await wait(3500);
 for(const query of ['Local','nonexistent-review-word','Chapter']){const start=Date.now();await frame.getByRole('button',{name:'Find',exact:true}).click();await frame.getByLabel('Find in document').fill(query);await frame.waitForFunction(()=>!document.querySelector('#navigation')?.textContent.includes('Searching…'));await wait(30);results.checks.push({case:'navigation',query,ms:Date.now()-start,buttons:await frame.locator('#navigation button').count()});}
 for(let i=0;i<20;i++){await frame.getByRole('button',{name:i%2?'Find':'Outline',exact:true}).click();if(await frame.locator('#navigation').isHidden())throw Error('Navigation mode switch hid the panel.');}
 await frame.getByLabel('Find in document').press('Escape');results.checks.push({case:'navigation-escape',passed:await frame.locator('#navigation').isHidden()});
 const{textFrame}= {textFrame:(await open('ui.md')).frame};await textFrame.locator('.segment:has(>p)').first().click();await textFrame.locator('.ProseMirror').press('Control+End');await host.page.keyboard.type('HISTORY');await textFrame.getByRole('button',{name:'Insert',exact:true}).click();await textFrame.getByRole('button',{name:'Link',exact:true}).click();const before=await textFrame.locator('.ProseMirror').textContent();await textFrame.getByLabel('Link text').fill('Local history');await textFrame.getByLabel('Link text').press('Control+z');results.checks.push({case:'local-undo',passed:before===await textFrame.locator('.ProseMirror').textContent()});await textFrame.getByRole('dialog').press('Escape');
 if(!await textFrame.getByRole('button',{name:'Export PDF',exact:true}).isVisible())await textFrame.getByRole('button',{name:'More',exact:true}).click();await textFrame.getByRole('button',{name:'Export PDF',exact:true}).click();await textFrame.getByLabel('Margin (mm)').fill('100');await textFrame.getByRole('button',{name:'Cancel',exact:true}).click();results.checks.push({case:'invalid-pdf-cancel',passed:await textFrame.getByRole('dialog').count()===0});
 for(const theme of ['Default Light Modern','Default Dark Modern','Default High Contrast']){await host.api('theme',{name:theme});await wait(400);await textFrame.locator('body').screenshot({path:join(out,'ui-'+theme.replaceAll(' ','-')+'.png')});}
}catch(error){results.errors.push(String(error));process.exitCode=1;}finally{await writeFile(join(out,'candidate.json'),JSON.stringify(results,null,2));if(host)await host.close();}
console.log(JSON.stringify({...results,measurements:results.measurements.map(row=>({...row,input:row.input?{...row.input,events:'see raw report'}:undefined}))}));
