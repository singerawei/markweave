import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parsePieces } from '../src/document/includeParser';
import { SourceRepository } from '../src/document/sourceFile';
import { DocumentGraph } from '../src/document/documentGraph';
import { LocalFileIO } from '../src/document/fileIO';
import { serializeSource } from '../src/document/serializer';
import type { FileIO } from '../src/shared/types';

function memory(files:Record<string,string>) {
  const writes:string[] = [];
  const io:FileIO = {
    read:async uri => { if (!(uri in files)) throw Object.assign(new Error('missing'),{code:'ENOENT'}); return files[uri]; },
    write:async (uri,text) => { files[uri] = text; writes.push(uri); },
    resolve:async (from,path) => new URL(path,from).href
  };
  return {repository:new SourceRepository(io),files,writes};
}
const root = 'file:///C:/docs/MASTER.md', child = 'file:///C:/docs/child.md', leaf = 'file:///C:/docs/leaf.md';

test('imports retain exact spelling and ignore code, quotes and HTML containers',() => {
  const raw = '# Root\r\n\r\n  @import "./child.md"  \r\n<!-- @import "./leaf.md" -->\r\n\r\n```md\n@import "./code.md"\n```\n\n> @import "./quote.md"\n\n<div>\n@import "./html.md"\n</div>\n';
  const pieces = parsePieces(raw);
  assert.equal(pieces.map(p => p.raw).join(''),raw);
  assert.deepEqual(pieces.filter(p => p.kind === 'import').map(p => p.path),['./child.md','./leaf.md']);
});
test('nested and repeated imports share ownership; only changed source is written',async () => {
  const fixture = memory({[root]:'# Root\n\n@import "./child.md"\n\n@import "./leaf.md"\n',[child]:'# Child\n\n@import "./leaf.md"\n',[leaf]:'# Leaf\n\nStripe\n'});
  const graph = new DocumentGraph(fixture.repository,root); await graph.build();
  assert.ok(graph.duplicates.has(leaf));
  assert.equal(graph.segments.filter(s => s.sourceUri === leaf && s.text.includes('Stripe')).length,2);
  const piece = fixture.repository.sources.get(leaf)!.pieces.find(p => p.raw.includes('Stripe'))!;
  const edits = [{uri:leaf,pieceId:piece.id,before:piece.raw,after:'Adyen\n'}];
  fixture.repository.apply(edits); await graph.build();
  assert.equal(graph.segments.filter(s => s.text === 'Adyen\n').length,2);
  await fixture.repository.save(graph.sourceUris);
  assert.deepEqual(fixture.writes,[leaf]);
  assert.ok(fixture.files[root].includes('@import "./child.md"'));
  fixture.repository.apply(edits,'before',false);
  assert.equal(serializeSource(fixture.repository.sources.get(leaf)!), '# Leaf\n\nStripe\n');
  fixture.repository.apply(edits,'after',false);
  assert.equal(serializeSource(fixture.repository.sources.get(leaf)!), '# Leaf\n\nAdyen\n');
});
test('cycle and missing include errors leave unrelated content editable and savable',async () => {
  const fixture = memory({[root]:'# Fine\n\n@import "./child.md"\n\n@import "./missing.md"\n',[child]:'@import "./MASTER.md"\n'});
  const graph = new DocumentGraph(fixture.repository,root); await graph.build();
  assert.ok(graph.segments.some(s => s.error?.includes('Circular')));
  assert.ok(graph.segments.some(s => s.error?.includes('Cannot read')));
  const piece = fixture.repository.sources.get(root)!.pieces[0];
  fixture.repository.apply([{uri:root,pieceId:piece.id,before:piece.raw,after:'# Still fine\n'}]);
  await fixture.repository.save(graph.sourceUris);
  assert.deepEqual(fixture.writes,[root]);
});
test('external modifications reload clean sources and retain both sides of conflicts',async () => {
  const fixture = memory({[root]:'original\n'}); const source = await fixture.repository.load(root);
  fixture.files[root] = 'external\n'; await fixture.repository.external(root);
  assert.equal(serializeSource(source),'external\n');
  fixture.repository.apply([{uri:root,pieceId:source.pieces[0].id,before:'external\n',after:'local\n'}]);
  fixture.files[root] = 'new external\n'; await fixture.repository.external(root);
  assert.equal(serializeSource(source),'local\n'); assert.equal(source.conflict?.external,'new external\n');
  await assert.rejects(fixture.repository.save([root]),/conflict/);
  await fixture.repository.resolveConflict(root,'keep'); await fixture.repository.save([root]);
  assert.equal(fixture.files[root],'local\n');
  fixture.repository.apply([{uri:root,pieceId:source.pieces[0].id,before:'local\n',after:'another local\n'}]);
  fixture.files[root] = 'latest\n'; await fixture.repository.external(root);
  await fixture.repository.resolveConflict(root,'reload'); assert.equal(serializeSource(source),'latest\n');
});
test('save detects races even before watcher notification; write failures keep dirty state',async () => {
  const fixture = memory({[root]:'old\n'}); const source = await fixture.repository.load(root);
  fixture.repository.apply([{uri:root,pieceId:'p0',before:'old\n',after:'new\n'}]);
  fixture.files[root] = 'raced\n'; await assert.rejects(fixture.repository.save([root]),/externally/);
  assert.deepEqual(fixture.writes,[]);
  await fixture.repository.resolveConflict(root,'keep');
  fixture.repository.io.write = async () => { throw new Error('read only'); };
  await assert.rejects(fixture.repository.save([root]),/read only/); assert.equal(source.dirty,true);
});
test('deleted sources can be explicitly recreated, and recreation clears stale conflicts',async () => {
  const fixture = memory({[root]:'old\n'}); const source = await fixture.repository.load(root);
  delete fixture.files[root]; await fixture.repository.external(root); assert.equal(source.deleted,true);
  fixture.files[root] = 'old\n'; await fixture.repository.external(root); assert.equal(source.conflict,undefined);
  delete fixture.files[root]; await fixture.repository.external(root);
  await fixture.repository.resolveConflict(root,'keep'); await fixture.repository.save([root]); assert.equal(fixture.files[root],'old\n');
});
test('stale edits and malformed multi-source transactions are rejected atomically',async () => {
  const fixture = memory({[root]:'one\n',[child]:'two\n'});
  await fixture.repository.load(root); await fixture.repository.load(child);
  assert.throws(() => fixture.repository.apply([{uri:root,pieceId:'p0',before:'stale',after:'bad'}]),/changed elsewhere/);
  assert.throws(() => fixture.repository.apply([{uri:root,pieceId:'p0',before:'one\n',after:'new'},{uri:child,pieceId:'missing',before:'',after:'bad'}]));
  assert.equal(serializeSource(fixture.repository.sources.get(root)!), 'one\n');
  const changes = [{uri:root,pieceId:'p0',before:'one\n',after:'new1\n'},{uri:child,pieceId:'p0',before:'two\n',after:'new2\n'}];
  fixture.repository.apply(changes); fixture.repository.apply(changes,'before',false);
  assert.equal(fixture.repository.sources.get(root)!.dirty,false); assert.equal(fixture.repository.sources.get(child)!.dirty,false);
});
test('restoring a deleted or detached source preserves local content and the conflict',async () => {
  const fixture = memory({[root]:'root\n'});
  const source = await fixture.repository.restore(child,'old\n','unsaved\n');
  assert.equal(source.dirty,true); assert.equal(source.conflict?.external,null);
  assert.equal(serializeSource(source),'unsaved\n');
  await fixture.repository.resolveConflict(child,'keep'); await fixture.repository.save([child]);
  assert.equal(fixture.files[child],'unsaved\n');
});
test('unreadable files are not misclassified as deleted and cannot be overwritten',async () => {
  const fixture = memory({[root]:'old\n'}); await fixture.repository.load(root);
  fixture.repository.apply([{uri:root,pieceId:'p0',before:'old\n',after:'new\n'}]);
  fixture.repository.io.read = async () => { throw Object.assign(new Error('denied'),{code:'EACCES'}); };
  await assert.rejects(fixture.repository.save([root]),/denied/);
  await assert.rejects(fixture.repository.resolveConflict(root,'keep'),/denied/);
  assert.deepEqual(fixture.writes,[]);
});
test('ordinary external text edits publish a local block patch',async () => {
  const fixture = memory({[root]:'# Title\n\nOld\n'}); await fixture.repository.load(root);
  const changes:any[] = []; fixture.repository.on('change',event => changes.push(event));
  fixture.files[root] = '# Title\n\nNew\n'; await fixture.repository.external(root);
  assert.equal(changes.some(event => event.kind === 'structure'),false);
  assert.equal(changes.find(event => event.kind === 'piece')?.text,'New\n');
});
test('a known child conflict prevents all writes including the dirty root',async()=>{
  const fixture=memory({[root]:'Root\n',[child]:'Child\n'});await fixture.repository.load(root);await fixture.repository.load(child);
  fixture.repository.apply([{uri:root,pieceId:'p0',before:'Root\n',after:'Root edited\n'},{uri:child,pieceId:'p0',before:'Child\n',after:'Child edited\n'}]);fixture.files[child]='External\n';await fixture.repository.external(child);
  await assert.rejects(fixture.repository.save([root,child]),/conflict/);assert.deepEqual(fixture.writes,[]);assert.equal(fixture.files[root],'Root\n');
});
test('a new disk race and write validation fail before any file is written',async()=>{
  const fixture=memory({[root]:'Root\n',[child]:'Child\n'});await fixture.repository.load(root);await fixture.repository.load(child);fixture.repository.apply([{uri:root,pieceId:'p0',before:'Root\n',after:'R\n'},{uri:child,pieceId:'p0',before:'Child\n',after:'C\n'}]);fixture.files[child]='Race\n';await assert.rejects(fixture.repository.save([root,child]),/No files/);assert.deepEqual(fixture.writes,[]);
});
test('draft structural edits preserve imports and saved baseline across undo/redo',async()=>{
  const fixture=memory({[root]:'# Root\r\n'});const source=await fixture.repository.load(root);const before=source.rawText,after=before+'\r\n@import "./child.md"\r\n';fixture.repository.editDraft(root,before,after);assert.equal(source.dirty,true);assert.equal(source.rawText,before);fixture.repository.editDraft(root,after,before);assert.equal(source.dirty,false);fixture.repository.editDraft(root,before,after);await fixture.repository.save([root]);assert.equal(fixture.files[root],after);
});
test('piece snapshots support a local paragraph join and undo after saving',async()=>{
 const fixture=memory({[root]:'One\n\nTwo\n'});const source=await fixture.repository.load(root);const before=source.pieces.slice(),hash=fixture.repository.fingerprint(root);const after=[{...before[0],raw:'OneTwo\n'}];fixture.repository.editPieces(root,hash,after);const joinedHash=fixture.repository.fingerprint(root);assert.equal(serializeSource(source),'OneTwo\n');await fixture.repository.save([root]);fixture.repository.editPieces(root,joinedHash,before);assert.equal(serializeSource(source),'One\n\nTwo\n');assert.equal(source.dirty,true);fixture.repository.editPieces(root,hash,after);assert.equal(source.dirty,false);
});
test('a write-stage disk race reports saved and pending files without losing dirty changes',async()=>{
  const fixture=memory({[root]:'Root\n',[child]:'Child\n'});await fixture.repository.load(root);await fixture.repository.load(child);
  fixture.repository.apply([{uri:root,pieceId:'p0',before:'Root\n',after:'R\n'},{uri:child,pieceId:'p0',before:'Child\n',after:'C\n'}]);
  const read=fixture.repository.io.read;let reads=0;fixture.repository.io.read=async uri=>{if(uri===child&&++reads===2)return 'Race\n';return read(uri);};
  await assert.rejects(fixture.repository.save([root,child]),error=>{assert.match(String(error),/Saved:/);assert.match(String(error),new RegExp('Pending: '+child.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));return true;});assert.deepEqual(fixture.writes,[root]);assert.equal(fixture.repository.sources.get(child)!.dirty,true);
});

test('real filesystem: Unicode, Windows separators, traversal, symlink and git diff',async t => {
  const directory = await mkdtemp(join(tmpdir(),'markweave-'));
  t.after(() => rm(directory,{recursive:true,force:true}));
  await mkdir(join(directory,'章节'));
  const masterPath = join(directory,'MASTER.md'), childPath = join(directory,'章节','支付.md');
  const masterText = '# Design\r\n\r\n@import ".\\章节\\支付.md"\r\n';
  await writeFile(masterPath,masterText); await writeFile(childPath,'# 支付\r\n\r\nStripe\r\n');
  execFileSync('git',['init','-q'],{cwd:directory}); execFileSync('git',['add','.'],{cwd:directory});
  execFileSync('git',['-c','user.name=Test','-c','user.email=test@example.invalid','commit','-qm','fixture'],{cwd:directory});
  const io = new LocalFileIO([directory]); const repository = new SourceRepository(io);
  const graph = new DocumentGraph(repository,pathToFileURL(masterPath).href); await graph.build();
  // Temporary directories may use Windows 8.3 short names on CI. Resolve the
  // include through the same canonicalization path the graph used.
  const source = repository.sources.get(await io.resolve(pathToFileURL(masterPath).href,'./章节/支付.md'))!;
  const piece = source.pieces.find(p => p.raw.includes('Stripe'))!;
  repository.apply([{uri:source.uri,pieceId:piece.id,before:piece.raw,after:'Adyen\r\n'}]); await repository.save(graph.sourceUris);
  assert.equal(await readFile(masterPath,'utf8'),masterText);
  const changed = execFileSync('git',['-c','core.quotepath=false','diff','--name-only'],{cwd:directory,encoding:'utf8'}).trim();
  assert.equal(changed,'章节/支付.md');
  await assert.rejects(io.resolve(source.uri,'../../escape.md'),/outside/);
  await assert.rejects(io.resolve(source.uri,'https://example.org/a.md'),/relative/);
  await assert.rejects(io.resolve(source.uri,'a.csv'),/Only .md/);
  await assert.rejects(io.resolve(source.uri,'file.md?x'),/relative/);
  const escape = await mkdtemp(join(tmpdir(),'markweave-outside-')); t.after(() => rm(escape,{recursive:true,force:true}));
  await writeFile(join(escape,'secret.md'),'secret');
  await symlink(escape,join(directory,'escape'),process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(io.resolve(pathToFileURL(masterPath).href,'./escape/secret.md'),/outside/);
});
