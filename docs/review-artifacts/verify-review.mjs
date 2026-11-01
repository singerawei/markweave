import {readFile,access,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const paths=['docs/PRODUCT_REVIEW.md','docs/review-artifacts/live/PERFORMANCE.md','docs/review-artifacts/interaction/UI_AUDIT.md','docs/review-artifacts/interaction/CODE_BLOCKS.md'];
const rows=[];
for(const file of paths){const content=await readFile(file,'utf8');let links=0;for(const match of content.matchAll(/\]\(([^)]+)\)/g)){const target=match[1];if(!/^https?:/.test(target)){await access(resolve(dirname(file),target));links++;}}rows.push({file,characters:content.length,localLinks:links});}
const perf=JSON.parse(await readFile('docs/review-artifacts/live/performance.json','utf8'));
if(perf.opens.length!==21)throw Error('Expected 21 completed performance cases');
for(const row of perf.opens)if(row.input&&row.input.summary.n===0)throw Error('Invalid empty input measurement');
const hash=createHash('sha256').update(await readFile('dist/editor.js')).digest('hex');if(hash!==perf.bundleHash)throw Error('Measured webview no longer matches current bundle');
const audit=JSON.parse(await readFile('docs/review-artifacts/interaction/audit.json','utf8'));if(audit.languages.length!==26||audit.actions.length!==158)throw Error('Unexpected audit counts');
if(audit.actions.some(x=>x.error))throw Error('Unhandled interaction audit failures');
const historical='docs/review-artifacts/INITIAL_REVIEW.md';let old=await readFile(historical,'utf8');if(!old.startsWith('> 历史')){old='> 历史：这是第一轮评估，已由 [当前深度报告](../PRODUCT_REVIEW.md) 替代。其中“本轮”均指第一轮，不代表后续真实宿主测试状态。\n\n'+old.replaceAll('](review-artifacts/','](').replace('](review-artifacts/)','](./)');await writeFile(historical,old);}
console.log(JSON.stringify({reports:rows,performanceCases:perf.opens.length,auditActions:audit.actions.length,uniqueActions:new Set(audit.actions.map(x=>x.name)).size,languages:audit.languages.length,bundleMatches:true},null,2));
