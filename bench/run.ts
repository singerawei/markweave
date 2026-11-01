import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { cpus, totalmem, platform, release } from 'node:os';
import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';
import { generate } from './generator';
import { SourceRepository } from '../src/document/sourceFile';
import { DocumentGraph } from '../src/document/documentGraph';
import { LocalFileIO } from '../src/document/fileIO';
async function main() {
const directory = resolve('bench/corpus'); await generate(directory);
const results = [];
for (const name of ['A-100KB.md','B-1MB.md','C-5MB.md','D-100-includes/MASTER.md','E-500-includes/MASTER.md']) {
  const repository = new SourceRepository(new LocalFileIO([directory]));
  const start = performance.now(); const graph = new DocumentGraph(repository,pathToFileURL(join(directory,name)).href); await graph.build();
  const loadMs = performance.now()-start;
  const segment = graph.segments.find(s => s.editable && s.text.includes('Local-first'))!;
  const timings = [];
  for (let i = 0; i < 100; i++) {
    const source = repository.sources.get(segment.sourceUri)!; const piece = source.pieces.find(p => p.id === segment.pieceId)!;
    const tick = performance.now(); repository.apply([{uri:source.uri,pieceId:piece.id,before:piece.raw,after:piece.raw+'a'}]); timings.push(performance.now()-tick);
  }
  timings.sort((a,b) => a-b);
  const save = performance.now(); await repository.save(graph.sourceUris); const saveMs = performance.now()-save;
  results.push({case:name,loadMs:Math.round(loadMs),segments:graph.segments.length,sources:graph.sourceUris.size,editP95Ms:+timings[95].toFixed(3),saveMs:+saveMs.toFixed(2),heapMB:Math.round(process.memoryUsage().heapUsed/1024/1024)});
}
let vscode = 'unavailable';
try { vscode = execFileSync(process.platform === 'win32' ? 'code.cmd' : 'code',['--version'],{encoding:'utf8',shell:process.platform === 'win32'}).trim(); } catch { /* CI may not have VS Code. */ }
const report = {timestamp:new Date().toISOString(),hardware:{cpu:cpus()[0].model,cores:cpus().length,ramGB:Math.round(totalmem()/1024**3),os:`${platform()} ${release()}`,node:process.version,vscode},scope:'Host model only. Browser cold-open, scrolling and event-to-render release gates require UI/VS Code measurements.',results};
await mkdir('bench/results',{recursive:true}); await writeFile('bench/results/host.json',JSON.stringify(report,null,2)+'\n');
console.table(results);
}
void main();
