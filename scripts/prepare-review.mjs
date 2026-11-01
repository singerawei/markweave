import{readFile,writeFile}from'node:fs/promises';
let source=await readFile('docs/review-artifacts/live-review.mjs','utf8');
source=source.replace("resolve('docs/review-artifacts/live')","resolve('docs/review-artifacts/response-0.3/live')");
source=source.replace("resolve('docs/review-artifacts/live-host.cjs')","resolve('scripts/review-bridge.cjs')");
let bridge=await readFile('docs/review-artifacts/live-host.cjs','utf8');
bridge=bridge.replace('const provider = extension.exports.provider;',`const provider = extension.exports.provider;
 const crypto=require('node:crypto');const buildHashes={};for(const name of ['editor.js','editor.css','extension.js','mermaid-runtime.js','export-renderer.js'])buildHashes[name]=crypto.createHash('sha256').update(await fs.readFile(path.join(extension.extensionPath,'dist',name))).digest('hex');`);
bridge=bridge.replace('vscode: vscode.version, documents:', 'vscode: vscode.version, buildHashes, extensionVersion:extension.packageJSON.version, documents:');
await writeFile('scripts/review-bridge.cjs',bridge);
// Preserve the original evidence and test helper; changes are confined to output
// location and an optional installed-package startup in an isolated profile.
source=source.replace("const child=spawn(",`let development=resolve('.');
 if(process.env.MARKDOWNUP_TEST_VSIX){
   const {execFileSync}=await import('node:child_process');const {readdir,writeFile,mkdir}=await import('node:fs/promises');const {existsSync}=await import('node:fs');
   const base=join(process.env.LOCALAPPDATA,'Programs','Microsoft VS Code');const cli=(await readdir(base)).map(name=>join(base,name,'resources','app','out','cli.js')).find(existsSync);
   execFileSync(join(base,'Code.exe'),[cli,'--extensions-dir='+join(directory,'extensions'),'--user-data-dir='+join(directory,'profile'),'--install-extension',resolve(process.env.MARKDOWNUP_TEST_VSIX)],{windowsHide:true,env:{...env,ELECTRON_RUN_AS_NODE:'1'},stdio:'pipe'});
   development=join(directory,'probe');await mkdir(development);await writeFile(join(development,'package.json'),JSON.stringify({name:'review-probe',publisher:'test',version:'0.0.1',engines:{vscode:'*'}}));
 }
 const child=spawn(`);
source=source.replace("'--disable-extensions',","...(process.env.MARKDOWNUP_TEST_VSIX?[]:['--disable-extensions']),").replace('`--extensionDevelopmentPath=${resolve(\'.\')}`','`--extensionDevelopmentPath=${development}`');
await writeFile('scripts/review-host.mjs',source);
