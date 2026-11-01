import {test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{parsePieces}from'../src/document/includeParser';import{parser,serializer}from'../src/webview/schema';import{preserveEdges}from'../src/document/serializer';
const source=readFileSync('docs/review-artifacts/interaction-audit.ts','utf8');
// This is the reviewed fixture literal, not an execution of the audit script.
const cases=Function('return ('+source.match(/const cases:[^\r\n]*=({[\s\S]*?});\s*const report/)![1]+')')()as Record<string,{language:string;code:string}>;
export{cases};
for(const[name,sample]of Object.entries(cases))test('review code remains a code block: '+name,()=>{
  const raw='```'+sample.language+'\r\n'+sample.code.replace(/\n/g,'\r\n')+'\r\n```\r\n';const pieces=parsePieces(raw);assert.ok(pieces.every(piece=>piece.kind==='markdown'&&piece.editable));const doc=parser.parse(raw);assert.equal(doc.firstChild?.type.name,'code_block');assert.equal(doc.firstChild?.textContent,sample.code);assert.equal(pieces.map(piece=>piece.raw).join(''),raw);
});
test('100 code round trips preserve CRLF, tabs, Unicode and fence characters',()=>{
  for(let index=0;index<100;index++){const raw='````cpp\r\n\t// 中文 '+index+'\r\nstd::vector<int> a = {1,2};\r\n// ``` inside\r\n````\r\n';const doc=parser.parse(raw);const saved=preserveEdges(raw,serializer.serialize(doc));assert.equal(parser.parse(saved).firstChild?.textContent,doc.firstChild?.textContent);assert.ok(saved.includes('\r\n'));assert.ok(saved.includes('\t// 中文'));}
});
