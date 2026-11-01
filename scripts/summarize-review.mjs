import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {validateEvidence} from './check-release.mjs';
const base='docs/review-artifacts/response-0.3';
const read=async file=>JSON.parse(await readFile(file,'utf8'));
const report=await read(join(base,'live/candidate.json'));
const build=await read(join(base,'build.json'));
if(report.version!==build.version||report.vsixSha256!==build.vsixSha256||Object.entries(build.buildHashes).some(([name,hash])=>report.buildHashes?.[name]!==hash))throw Error('Candidate evidence does not match the packaged build.');
const log=async file=>{const bytes=await readFile(file);return bytes.toString(bytes[0]===255&&bytes[1]===254?'utf16le':'utf8');};
const hostPassed=/MARKDOWNUP_HOST_TESTS_PASSED/.test(await log('bench/results/installed-host.log'))&&/VS Code host exit: 0/.test(await log('bench/results/installed-host.log'));
const uiPassed=/14 passed/.test(await log('bench/results/ui-latest.log'));
const host=await read('bench/results/vscode.json'),clipboard=await read('bench/results/clipboard.json');
const percentile=(values,p=.95)=>{const sorted=values.slice().sort((a,b)=>a-b);return sorted[Math.ceil(sorted.length*p)-1];};
const counts={prose:0,code:0,table:0};
for(const row of report.measurements){if(!row.input)continue;counts[row.case.startsWith('code-')?'code':row.case.startsWith('table-')?'table':'prose']+=row.input.events.filter(event=>event.key.length===1).length;}
const acceptance={...report,inputSampleCounts:counts,
 clipboard:{samples:clipboard.samples.length,failures:clipboard.samples.filter(sample=>!sample.verified).length,osReadback:clipboard.samples.every(sample=>sample.verified)},
 png:{samples:hostPassed?20:0,failures:hostPassed?0:1,scope:'Host service rendered twenty Chinese/HTML-label PNGs and checked signatures; representative image visually inspected.'},
 scroll:{durationMs:0,p95Ms:Math.max(...host.results.map(row=>row.scrollP95Ms)),persistentLongTasks:null,scope:'Short 40-frame host smoke samples only; not the required 60-second measurement.'},
 save:{samples:0,onlyExpectedSources:false,scope:'Functional source-ownership checks passed; the required 50 timed targeted saves were not collected.'},
 manual:{users:0,successfulUsers:0,imeCommits:0,realIme:false,pdfVisualCases:0,pdfVisualFailures:null,recoveryCases:0,recoveryFailures:null},
 automation:{hostPassed,uiPassed},
 scope:'Development verification only. Manual zeros mean not collected. Automated sample counts are synthetic CDP key samples, not real IME commits.'};
acceptance.pending=validateEvidence(acceptance,{hash:build.buildHashes['editor.js'],hashes:build.buildHashes,version:build.version,vsixSha256:build.vsixSha256});
await writeFile(join(base,'acceptance.json'),JSON.stringify(acceptance,null,2)+'\n');
const ms=value=>value===undefined?'—':Number(value).toFixed(1);
let markdown=`# 0.3.0 installed-package results\n\nMeasured: ${report.timestamp}. Installed extension: ${report.extensionVersion}. Functional host suite: ${hostPassed?'passed':'failed'}. UI suite (14 cases): ${uiPassed?'passed':'failed'}. Core suite: 64 cases (see ui/check-latest.log).\n\nVSIX SHA-256: \`${build.vsixSha256}\`. Runtime hashes: [build.json](build.json). Raw CDP data: [candidate.json](live/candidate.json). Original baseline and methodology: [PERFORMANCE.md](../live/PERFORMANCE.md).\n\nThis is one cold/warm Mermaid pair and one opening per document. Times exclude VS Code application boot. Input latency is synthetic keydown to the second updated animation frame; it does not measure physical keyboard/display or real IME latency.\n\n| Mermaid mode | First graph ms | All 20 ms | Count |\n| --- | ---: | ---: | ---: |\n`;
for(const row of report.measurements.filter(row=>row.case==='20-diagrams'))markdown+=`| ${row.mode} | ${ms(row.firstMs)} | ${ms(row.allMs)} | ${row.count} |\n`;
markdown+='\nOriginal cold total was about 16.71–17.05 seconds. Cached results are reported separately.\n\n| Document | Readable ms | Editable ms | Input n | Input P95 ms | Input P99 ms | Native fallback blocks |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: |\n';
for(const row of report.measurements.filter(row=>row.case!=='20-diagrams')){const values=row.input?.events.filter(event=>event.key.length===1).map(event=>event.ms)??[];markdown+=`| ${row.case} | ${ms(row.metrics?.readable)} | ${ms(row.metrics?.editable)} | ${values.length} | ${ms(percentile(values))} | ${ms(percentile(values,.99))} | ${row.fallback} |\n`;}
markdown+='\nNative fallback preserves all source bytes, shows at most 4000 preview characters and offers Text Editor. Limits: 128 KiB code, 16 KiB prose, 200 table rows. Large editable code uses syntax colors near the caret.\n\n| Navigation query | End-to-end ms | Buttons |\n| --- | ---: | ---: |\n';
for(const row of report.checks.filter(row=>row.case==='navigation'))markdown+=`| ${row.query} | ${row.ms} | ${row.buttons} |\n`;
markdown+=`\nClipboard OS readback: ${clipboard.samples.filter(sample=>sample.verified).length}/${clipboard.samples.length} confirmed. Unavailable results are failures, with visible retry feedback. PNG: 20 service renders/signature checks; Chinese representative image inspected. PDF: representative Chinese/include/Mermaid/header/footer page inspected; 30-case visual matrix is pending. Theme screenshots are in live/.\n\nThe host's short scroll smoke sample reached ${ms(acceptance.scroll.p95Ms)} ms P95 in the slowest scenario; it is not a 60-second acceptance run. No claim of a stable-release pass is made.\n\n## Stable-release gate\n\nThe gate remains ${acceptance.pending.length?'BLOCKED':'PASSED'}. Missing samples and manual work are retained as failures:\n\n`;
markdown+=acceptance.pending.map(message=>'- '+message).join('\n')+'\n\nReproduce: set MARKDOWNUP_TEST_VSIX to the VSIX, run npm run test:review, then node scripts/summarize-review.mjs and npm run release:gate. The last command must fail until all conditions have matching evidence.\n';
await writeFile(join(base,'RESULTS.md'),markdown);
console.log(JSON.stringify({hostPassed,uiPassed,releaseBlocked:acceptance.pending.length>0,pending:acceptance.pending}));
