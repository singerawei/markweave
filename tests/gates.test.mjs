import{test}from'node:test';import assert from'node:assert/strict';import{validateEvidence}from'../scripts/check-release.mjs';
test('release fails closed for missing, stale or incomplete evidence',()=>{assert.ok(validateEvidence({},{hash:'current',version:'0.3.0'}).length>5);});
test('artificially exceeding a measured threshold blocks release',()=>{
 const report={sha256:'hash',version:'v',installed:true,errors:[],measurements:[{case:'20-diagrams',mode:'cold',count:20,firstMs:1501,allMs:5001},{case:'20-diagrams',mode:'cached',count:20,allMs:501}],checks:[]};const failures=validateEvidence(report,{hash:'hash',version:'v'},false);assert.ok(failures.some(message=>message.includes('first diagram')));assert.ok(failures.some(message=>message.includes('total exceeded')));
});
