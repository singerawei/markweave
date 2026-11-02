import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,readFile,rm,realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { EditorProvider } from '../../src/extension/editorProvider';
import { generate } from '../../bench/generator';
import { CompositeDocument } from '../../src/extension/compositeDocument';
import{serializeSource}from'../../src/document/serializer';

export async function run() {
  const directory = await realpath(await mkdtemp(join(vscode.workspace.workspaceFolders![0].uri.fsPath,'fixture-')));
  const extension = vscode.extensions.getExtension('markweave.markweave')!;
  await extension.activate();
  const provider = extension.exports.provider as EditorProvider;
  const master = join(directory,'MASTER.md'),child = join(directory,'child.md');
  const masterText = '# Root\n\n@import "./child.md"\n';
  await writeFile(master,masterText); await writeFile(child,'# Child\n\nStripe\n');
  // Use a private provider document to exercise save, backup and edit events
  // against the real VS Code API. Browser interaction is covered separately.
  const document = await provider.openCustomDocument(vscode.Uri.file(master),{backupId:undefined,untitledDocumentData:undefined});
  let receive:(message:any) => void = () => {};
  const posted:any[] = [];
  const panel = {
    active:true,
    webview:{options:{},html:'',asWebviewUri:(uri:vscode.Uri) => uri,cspSource:'vscode-resource:',
      postMessage:async (message:any) => { posted.push(message); return true; },
      onDidReceiveMessage:(handler:any) => { receive = handler; return new vscode.Disposable(() => {}); }},
    onDidDispose:() => new vscode.Disposable(() => {})
  } as unknown as vscode.WebviewPanel;
  await provider.resolveCustomEditor(document,panel);
  receive({type:'ready'});
  const wait = async (predicate:()=>boolean) => {
    const deadline = Date.now()+10000;
    while (!predicate()) { if (Date.now()>deadline) throw new Error('Host test timed out'); await new Promise(resolve => setTimeout(resolve,20)); }
  };
  await wait(() => posted.some(message => message.type === 'document' && !message.readOnly));
  console.log("HOST_STAGE preferences");
  await wait(() => posted.some(message => message.type === 'preferences'));
  receive({type:'preference',key:'navigationPinned',value:true});
  await wait(() => posted.some(message => message.type === 'preferences' && message.preferences?.navigationPinned === true));
  receive({type:'preference',key:'toolbarHidden',value:true});
  await wait(() => posted.some(message => message.type === 'preferences' && message.preferences?.toolbarHidden === true));
  receive({type:'preference',key:'navigationMode',value:'outline'});
  await wait(() => posted.some(message => message.type === 'preferences' && message.preferences?.navigationMode === 'outline'));
  const savedPreferences = provider.context.workspaceState.get<Record<string,unknown>>('markweave.preferences:'+document.uri.toString())!;
  assert.equal(savedPreferences.navigationPinned,true);
  assert.equal(savedPreferences.toolbarHidden,true);
  assert.equal(savedPreferences.navigationMode,'outline');
  receive({type:'preference',key:'navigationPinned',value:false});
  await wait(() => posted.some(message => message.type === 'preferences' && message.preferences?.navigationPinned === false));
  console.log("HOST_STAGE commands");
  const registered = await vscode.commands.getCommands(true);
  for(const command of ['markweave.save','markweave.saveAs','markweave.find','markweave.outline','markweave.navigate','markweave.pinNavigation','markweave.toggleToolbar','markweave.insert','markweave.focusMode','markweave.help','markweave.exportPdf']){
    assert.ok(registered.includes(command),`Registered command missing: ${command}`);
  }
  for(const [command,action] of [['markweave.help','help'],['markweave.pinNavigation','pinNavigation'],['markweave.toggleToolbar','toggleToolbar'],['markweave.find','find'],['markweave.insert','insert']]){
    await vscode.commands.executeCommand(command);
    await wait(() => posted.some(message => message.type === 'command' && message.command === action));
  }
  const childUri = await document.repository.io.resolve(document.rootUri,'./child.md');
  const source = document.repository.sources.get(childUri)!;
  const piece = source.pieces.find(p => p.raw.includes('Stripe'))!;
  let event:vscode.CustomDocumentEditEvent<any> | undefined;
  const subscription = provider.onDidChangeCustomDocument(change => { event = change; });
  receive({type:'edit',uri:source.uri,pieceId:piece.id,before:piece.raw,text:'Adyen\n',origin:'integration'});
  await wait(() => !!event); assert.equal(document.dirtySources.size,1);
  await provider.saveCustomDocument(document);
  assert.equal(await readFile(master,'utf8'),masterText); assert.match(await readFile(child,'utf8'),/Adyen/);
  await event!.undo(); await provider.saveCustomDocument(document); assert.match(await readFile(child,'utf8'),/Stripe/);
  await event!.redo();
  const backup = await provider.backupCustomDocument(document,{destination:vscode.Uri.file(join(directory,'backup.json'))});
  assert.match(await readFile(join(directory,'backup.json'),'utf8'),/Adyen/);
  await provider.revertCustomDocument(document); assert.equal(source.dirty,false);
  console.log("HOST_STAGE clipboard");
  await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(master));
  const clipboardRead=()=>Promise.race([Promise.resolve(vscode.env.clipboard.readText()),new Promise<string>(resolve=>setTimeout(()=>resolve(''),1500))]);
  const oldClipboard=await clipboardRead();const clipboardEvidence:{verified:boolean;error?:string}[]=[];
  try{for(let i=0;i<20;i++){const id='copy-'+i;receive({type:'copy',id,text:'Native clipboard sample '+i});await wait(()=>posted.some(message=>message.type==='result'&&message.id===id));const response=posted.find(message=>message.type==='result'&&message.id===id);if(response.error){assert.match(response.error,/Clipboard/);clipboardEvidence.push({verified:false,error:response.error});}else{assert.equal(await clipboardRead(),'Native clipboard sample '+i);clipboardEvidence.push({verified:true});}}}finally{await Promise.race([Promise.resolve(vscode.env.clipboard.writeText(oldClipboard)),new Promise(resolve=>setTimeout(resolve,1500))]);}
  await writeFile(join(process.env.MARKWEAVE_REPORT_DIR!,'clipboard.json'),JSON.stringify({scope:'Real VS Code clipboard API, confirmed by readback; unavailable results are not counted as successful OS clipboard acceptance.',samples:clipboardEvidence},null,2));
  console.log("HOST_STAGE save-as");
  const rootModel=document.repository.sources.get(document.rootUri)!;const rootHeading=rootModel.pieces[0];document.repository.apply([{uri:document.rootUri,pieceId:rootHeading.id,before:rootHeading.raw,after:'# Copy only\n\n'}]);await provider.saveCustomDocumentAs(document,vscode.Uri.file(join(directory,'COPY.md')));assert.equal(await readFile(master,'utf8'),masterText);assert.match(await readFile(join(directory,'COPY.md'),'utf8'),/Copy only/);await provider.revertCustomDocument(document);
  console.log("HOST_STAGE include");
  const importPiece=rootModel.pieces.find(piece=>piece.kind==='import')!;receive({type:'include-edit',id:'remove-include',action:'remove',uri:document.rootUri,pieceId:importPiece.id});await wait(()=>posted.some(message=>message.type==='result'&&message.id==='remove-include'));assert.ok(!rootModel.pieces.some(piece=>piece.kind==='import'));await event!.undo();assert.ok(rootModel.pieces.some(piece=>piece.kind==='import'));await provider.revertCustomDocument(document);
  console.log("HOST_STAGE paragraph-join");
  document.repository.editDraft(source.uri,serializeSource(source),'# Child\n\nOne\n\nTwo\n');await wait(()=>posted.filter(message=>message.type==='document').some(message=>message.segments.some((segment:any)=>segment.text.includes('Two'))));const first=source.pieces.find(piece=>piece.raw.startsWith('One'))!,second=source.pieces.find(piece=>piece.raw.startsWith('Two'))!;receive({type:'join-blocks',id:'join-test',uri:source.uri,first:first.id,second:second.id});await wait(()=>posted.some(message=>message.type==='result'&&message.id==='join-test'));assert.match(serializeSource(source),/OneTwo/);await event!.undo();assert.match(serializeSource(source),/One\n\nTwo/);await event!.redo();assert.match(serializeSource(source),/OneTwo/);await event!.undo();await provider.revertCustomDocument(document);
  console.log("HOST_STAGE recovery");
  subscription.dispose(); document.panels.clear(); document.dispose();
  const restored = await provider.openCustomDocument(vscode.Uri.file(master),{backupId:backup.id,untitledDocumentData:undefined});
  assert.ok([...restored.dirtySources].includes(childUri));
  await provider.saveCustomDocument(restored); assert.match(await readFile(child,'utf8'),/Adyen/);
  restored.dispose();
  const pending = await provider.openCustomDocument(vscode.Uri.file(master),{backupId:undefined,untitledDocumentData:undefined});
  await pending.graph.build(); pending.trackSources();
  const rootSource = pending.repository.sources.get(pending.rootUri)!;
  const heading = rootSource.pieces[0];
  pending.repository.apply([{uri:pending.rootUri,pieceId:heading.id,before:heading.raw,after:'# Root changed\n'}]);
  const deletedBackup = await provider.backupCustomDocument(pending,{destination:vscode.Uri.file(join(directory,'deleted-backup.json'))});
  pending.dispose(); await rm(master);
  const deletedRestore = await provider.openCustomDocument(vscode.Uri.file(master),{backupId:deletedBackup.id,untitledDocumentData:undefined});
  assert.equal(deletedRestore.repository.sources.get(deletedRestore.rootUri)!.conflict?.external,null);
  await deletedRestore.repository.resolveConflict(deletedRestore.rootUri,'keep'); await provider.saveCustomDocument(deletedRestore);
  assert.match(await readFile(master,'utf8'),/Root changed/); deletedRestore.dispose();
  console.log("HOST_STAGE pdf");
  await writeFile(child,'# Payment 中文\n\nSaved version\n\n```mermaid\nflowchart LR\n A[Start] --> B[Finish]\n```\n');
  const pdfDoc=await provider.openCustomDocument(vscode.Uri.file(master),{backupId:undefined,untitledDocumentData:undefined});await pdfDoc.graph.build();pdfDoc.trackSources();
  const pdfChildUri=await pdfDoc.repository.io.resolve(pdfDoc.rootUri,'./child.md');const payment=pdfDoc.repository.sources.get(pdfChildUri)!;const paymentPiece=payment.pieces.find(piece=>piece.raw.includes('Saved version'))!;
  pdfDoc.repository.apply([{uri:payment.uri,pieceId:paymentPiece.id,before:paymentPiece.raw,after:'UNSAVED EXPORT SNAPSHOT\n'}]);
  const pdf=await provider.exportToPdf(pdfDoc,{format:'A4',landscape:false,margin:20,fontSize:14,header:'Integration test',footer:'Offline export',pageNumbers:true,headingBreak:false,preview:true});
  const pdfBytes=await readFile(pdf!.fsPath);assert.equal(pdfBytes.subarray(0,4).toString(),'%PDF');assert.ok(pdfBytes.length>2000);assert.match(await readFile(child,'utf8'),/Saved version/);
  await writeFile(join(process.env.MARKWEAVE_REPORT_DIR!,'export-sample.pdf'),pdfBytes);
  const diagramPiece=payment.pieces.find(piece=>piece.raw.includes('flowchart LR'))!;
  pdfDoc.repository.apply([{uri:payment.uri,pieceId:diagramPiece.id,before:diagramPiece.raw,after:'```mermaid\ninvalid diagram !!!\n```\n'}]);
  await assert.rejects(provider.exportToPdf(pdfDoc,{format:'A4',landscape:false,margin:20,fontSize:14,header:'',footer:'',pageNumbers:true,headingBreak:false,preview:true}));
  pdfDoc.repository.apply([{uri:payment.uri,pieceId:diagramPiece.id,before:diagramPiece.raw,after:'![Missing](./does-not-exist.png)\n'}]);
  await assert.rejects(provider.exportToPdf(pdfDoc,{format:'A4',landscape:false,margin:20,fontSize:14,header:'',footer:'',pageNumbers:true,headingBreak:false,preview:true}));
  pdfDoc.dispose();await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  console.log("HOST_STAGE pdf-extended");
  const extendedPath=join(directory,'extended.md');
  await writeFile(extendedPath,'---\ntitle: Extended\n---\n\n# Extended\n\n## Section\n\n[TOC]\n\n> [!NOTE]\n> Alert body.\n\n!!! tip "Hint"\n    Tip body.\n\nTerm\n: Definition\n\nMath $x^2$ and\n\n$$\n\\int_0^1 x^2 dx\n$$\n\n==hi== H~2~O x^2^ :smile:\n\nAPI works.\n\n*[API]: Application Programming Interface\n\nFoot[^1].\n\n[^1]: Note body.\n\n<kbd>Ctrl</kbd>\n');
  const extendedDoc=await provider.openCustomDocument(vscode.Uri.file(extendedPath),{backupId:undefined,untitledDocumentData:undefined});await extendedDoc.graph.build();extendedDoc.trackSources();
  const extendedPdf=await provider.exportToPdf(extendedDoc,{format:'A4',landscape:false,margin:20,fontSize:14,header:'',footer:'',pageNumbers:true,headingBreak:false,preview:true});
  const extendedBytes=await readFile(extendedPdf!.fsPath);assert.equal(extendedBytes.subarray(0,4).toString(),'%PDF');assert.ok(extendedBytes.length>2000);
  extendedDoc.dispose();
  await writeFile(child,'# Child\n\nStripe\n');
  console.log("HOST_STAGE png");
  for(let i=0;i<20;i++){const png=await(provider as any).diagrams.png(`flowchart LR\n A["中文 <b>text ${i}</b>"] --> B[End]`,false);assert.equal(Buffer.from(png).subarray(0,8).toString('hex'),'89504e470d0a1a0a');if(i===0)await writeFile(join(process.env.MARKWEAVE_REPORT_DIR!,'diagram-export.png'),png);}
  console.log("HOST_STAGE webview-bench");
  // Smoke the registered custom editor and an actual webview in an isolated profile.
  await vscode.commands.executeCommand('vscode.openWith',vscode.Uri.file(master),'markweave.editor');
  const liveDocuments = (provider as any).documents as Set<CompositeDocument>;
  await wait(() => [...liveDocuments].some(doc => doc.uri.fsPath.toLowerCase() === master.toLowerCase() && doc.metrics.editable !== undefined));
  await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  const corpus = join(directory,'corpus'); await generate(corpus);
  const results = [];
  for (const name of ['B-1MB.md','C-5MB.md','D-100-includes/MASTER.md','M-1MB-20-diagrams.md','M-5MB-100-diagrams.md','M-composite/MASTER.md']) {
    const file = join(corpus,name);
    console.log('HOST_BENCH_CASE',name);
    await vscode.commands.executeCommand('vscode.openWith',vscode.Uri.file(file),'markweave.editor');
    let live:CompositeDocument | undefined;
    await wait(() => { live = [...liveDocuments].find(doc => doc.uri.fsPath.toLowerCase() === file.toLowerCase()); return live?.metrics.editable !== undefined; });
    console.log('HOST_BENCH_EDITABLE',name,live!.metrics);
    if(name.startsWith('M-'))await wait(()=>live!.metrics.diagram!==undefined);
    console.log('HOST_BENCH_DIAGRAM_DONE',name);
    for (const panel of live!.panels) await panel.webview.postMessage({type:'benchmark'});
    await wait(() => !!live!.benchmark);
    console.log('HOST_BENCH_DONE',name,live!.benchmark);
    const start = Date.now(); await provider.saveCustomDocument(live!); const saveMs = Date.now()-start;
    results.push({case:name,readableMs:live!.metrics.readable,editableMs:live!.metrics.editable,diagramMs:live!.metrics.diagram,saveMs,...live!.benchmark});
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  }
  await writeFile(join(process.env.MARKWEAVE_REPORT_DIR ?? join(extension.extensionPath,'bench/results'),'vscode.json'),JSON.stringify({timestamp:new Date().toISOString(),vscode:vscode.version,scope:'Real VS Code webview; synthetic browser insertText and frame-to-frame scroll samples; timings start at CustomDocument creation, exclude VS Code application launch.',results},null,2)+'\n');
  console.table(results);
  // The runner owns this temporary workspace and removes it after VS Code
  // exits. Windows file watchers can still hold the directory while alive.
  console.log('MARKWEAVE_HOST_TESTS_PASSED: save, ownership, undo/redo, backup/restore, registered webview');
}
