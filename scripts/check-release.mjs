import{readFile}from'node:fs/promises';import{createHash}from'node:crypto';import{pathToFileURL}from'node:url';
export function validateEvidence(report,{hash,version,hashes,vsixSha256},strict=true){
  const failures=[];const check=(ok,message)=>{if(!ok)failures.push(message);};const p95=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.ceil(sorted.length*.95)-1]??Infinity;};
  check(report.sha256===hash,'Evidence must match the production webview hash.');check(report.version===version,'Evidence version mismatch.');check(report.installed===true,'Installed-VSIX evidence is required.');check(Array.isArray(report.errors)&&report.errors.length===0,'Unresolved test errors.');
  const measurements=report.measurements??[];
  for(const mode of ['cold','cached']){const rows=measurements.filter(row=>row.case==='20-diagrams'&&row.mode===mode);check(rows.length>0,'Missing Mermaid '+mode+' measurements.');for(const row of rows){check(row.count===20,'All twenty diagrams must finish.');check(row.allMs<=(mode==='cold'?5000:500),'Mermaid '+mode+' total exceeded.');if(mode==='cold')check(row.firstMs<=1500,'Cold first diagram exceeded 1.5 s.');}}
  for(const name of ['single-5MB.md','includes-100.md','includes-500.md']){const rows=measurements.filter(row=>row.case===name);check(rows.length>=(strict?30:1),'Insufficient opening repetitions: '+name);check(p95(rows.map(row=>row.metrics?.readable??Infinity))<=2000,'Readable P95 exceeded: '+name);check(p95(rows.map(row=>row.metrics?.editable??Infinity))<=3000,'Editable P95 exceeded: '+name);}
  for(const row of measurements){const events=row.input?.events?.filter(event=>event.key.length===1)??[];if(events.length){check(p95(events.map(event=>event.ms))<=50,'Input P95 exceeded: '+row.case);const sorted=events.map(event=>event.ms).sort((a,b)=>a-b);check(sorted[Math.ceil(sorted.length*.99)-1]<=100,'Input P99 exceeded: '+row.case);}}
  const nav=(report.checks??[]).filter(row=>row.case==='navigation');check(nav.length>=3,'Missing navigation measurements.');for(const row of nav){check(row.buttons<=100,'Navigation DOM exceeded 100 controls.');check(row.ms<=300,'Navigation response exceeded 300 ms.');}
  for(const row of report.checks??[])if('passed'in row)check(row.passed===true,'Functional check failed: '+row.case);
  if(strict){
    for(const name of ['local-undo','navigation-escape','invalid-pdf-cancel'])check((report.checks??[]).some(row=>row.case===name&&row.passed===true),'Missing functional check: '+name);
    check((report.clipboard?.samples??0)>=20&&report.clipboard.failures===0&&report.clipboard.osReadback===true,'OS clipboard acceptance not complete.');
    check((report.png?.samples??0)>=20&&report.png.failures===0,'PNG export acceptance not complete.');
    check(!!hashes&&Object.entries(hashes).every(([key,value])=>report.buildHashes?.[key]===value),'All installed runtime hashes must match.');check(!!vsixSha256&&report.vsixSha256===vsixSha256,'Installed VSIX hash mismatch.');
    for(const kind of ['prose','code','table'])check((report.inputSampleCounts?.[kind]??0)>=1000,'At least 1000 input samples required: '+kind);
    check((report.scroll?.durationMs??0)>=60000&&report.scroll.p95Ms<=33.3&&report.scroll.persistentLongTasks===0,'Missing/pending 60-second scroll gate.');
    check((report.save?.samples??0)>=50&&report.save.p95Ms<=200&&report.save.onlyExpectedSources===true,'Missing/pending targeted-save gate.');
    check((report.manual?.users??0)>=10&&(report.manual?.successfulUsers??0)>=9,'User study not complete.');check((report.manual?.imeCommits??0)>=1000&&report.manual.realIme===true,'Real IME acceptance not complete.');
    check((report.manual?.pdfVisualCases??0)>=30&&report.manual.pdfVisualFailures===0,'PDF visual matrix not complete.');
    check((report.manual?.recoveryCases??0)>=50&&report.manual.recoveryFailures===0,'Recovery acceptance not complete.');
  }
  return failures;
}
if(import.meta.url===pathToFileURL(process.argv[1]).href){try{
  const file=process.argv[2]??'docs/review-artifacts/response-2.0.0/acceptance.json';const report=JSON.parse(await readFile(file,'utf8'));const version=JSON.parse(await readFile('package.json','utf8')).version;const hashes={};for(const name of ['editor.js','editor.css','extension.js','mermaid-runtime.js','export-renderer.js'])hashes[name]=createHash('sha256').update(await readFile('dist/'+name)).digest('hex');const hash=hashes['editor.js'];const vsixSha256=createHash('sha256').update(await readFile(`markweave-win32-x64-${version}.vsix`)).digest('hex');const failures=validateEvidence(report,{hash,version,hashes,vsixSha256});if(failures.length){console.error('RELEASE BLOCKED\n'+failures.join('\n'));process.exitCode=1;}else console.log('Release acceptance passed.');
}catch(error){console.error('RELEASE BLOCKED: acceptance evidence is missing or unreadable. '+String(error));process.exitCode=1;}}
