import { EventEmitter } from 'node:events';
import{createHash}from'node:crypto';
import { parsePieces } from './includeParser';
import { serializeSource } from './serializer';
import type { FileIO, SourceFileModel, PieceEdit,SourcePiece } from '../shared/types';

export class SourceRepository extends EventEmitter {
  readonly sources = new Map<string, SourceFileModel>();
  private loading = new Map<string, Promise<SourceFileModel>>();
  constructor(readonly io: FileIO) { super(); }
  async load(uri: string): Promise<SourceFileModel> {
    const existing = this.sources.get(uri);
    if (existing) return existing;
    let pending = this.loading.get(uri);
    if (!pending) {
      pending = this.io.read(uri).then(text => {
        const pieces = parsePieces(text);
        const source: SourceFileModel = { uri,rawText:text,version:1,pieces,dirty:false,changedPieces:new Set(),pieceById:new Map(pieces.map(piece => [piece.id,piece])) };
        this.sources.set(uri,source); return source;
      }).finally(() => this.loading.delete(uri));
      this.loading.set(uri,pending);
    }
    return pending;
  }
  apply(edits: PieceEdit[], direction: 'before' | 'after' = 'after', validate = true, origin?: string) {
    for (const edit of edits) {
      const source = this.sources.get(edit.uri);
      const piece = source?.pieceById.get(edit.pieceId);
      if (!source || !piece || piece.kind !== 'markdown') throw new Error('Source block no longer exists. Reload the document.');
      if (validate && piece.raw !== edit[direction === 'after' ? 'before' : 'after']) throw new Error('This block changed elsewhere. Your edit was not applied; copy it before reloading.');
    }
    for (const edit of edits) {
      const source = this.sources.get(edit.uri)!;
      const piece = source.pieceById.get(edit.pieceId)!;
      piece.raw = edit[direction];
      source.version++;
      if (piece.kind === 'markdown' && piece.raw === piece.original) source.changedPieces.delete(piece.id);
      else source.changedPieces.add(piece.id);
      source.dirty = !!source.baselineDiverged || source.changedPieces.size > 0;
      this.emit('change',{kind:'piece',uri:source.uri,pieceId:piece.id,text:piece.raw,version:source.version,origin});
    }
  }
  async external(uri: string) {
    const source = this.sources.get(uri);
    if (!source) return;
    let external: string | null;
    try { external = await this.io.read(uri); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; external = null; }
    if (external === source.rawText) {
      if (source.conflict || source.deleted) {
        delete source.conflict; delete source.deleted;
        this.emit('change',{kind:'structure',uri});
      }
      return;
    }
    if (external === serializeSource(source)) {
      source.rawText = external!; source.dirty = false; delete source.conflict;
      this.markSaved(source);
      this.emit('change',{kind:'status',uri}); return;
    } else if (source.dirty) {
      source.conflict = {external}; this.emit('change',{kind:'status',uri}); return;
    }
    else if (external === null) { source.deleted = true; source.conflict = {external:null}; }
    else {
      const pieces = parsePieces(external);
      const stable = pieces.length === source.pieces.length && pieces.every((piece,i) => {
        const old = source.pieces[i];
        return piece.kind === old.kind && (piece.kind === 'import' ? old.kind === 'import' && piece.path === old.path : old.kind === 'markdown' && piece.editable === old.editable);
      });
      if (stable) {
        const changed = pieces.filter((piece,i) => piece.raw !== source.pieces[i].raw);
        source.rawText = external; source.pieces = pieces; source.pieceById = new Map(pieces.map(piece => [piece.id,piece])); source.version++;
        delete source.deleted; delete source.conflict;
        for (const piece of changed) if (piece.kind === 'markdown') this.emit('change',{kind:'piece',uri,pieceId:piece.id,text:piece.raw,version:source.version});
        this.emit('change',{kind:'status',uri}); return;
      }
      this.replace(source,external);
    }
    this.emit('change',{kind:'structure',uri});
  }
  replace(source: SourceFileModel, text: string) {
    source.rawText = text; source.pieces = parsePieces(text); source.version++;
    source.pieceById = new Map(source.pieces.map(piece => [piece.id,piece]));
    source.dirty = false; source.changedPieces.clear(); delete source.conflict; delete source.deleted; delete source.baselineDiverged;
  }
  editDraft(uri:string,expected:string,text:string){
    const source=this.sources.get(uri);if(!source)throw new Error('Source is not loaded.');
    if(source.conflict)throw new Error('Resolve the source conflict before changing includes.');
    if(serializeSource(source)!==expected)throw new Error('The source changed. Retry the operation.');
    const baseline=source.rawText;this.replace(source,text);source.rawText=baseline;source.dirty=text!==baseline;source.baselineDiverged=source.dirty;this.emit('change',{kind:'structure',uri});
  }
  fingerprint(uri:string){return createHash('sha256').update(serializeSource(this.sources.get(uri)!)).digest('hex');}
  editPieces(uri:string,expectedHash:string,pieces:SourcePiece[]){
    const source=this.sources.get(uri);if(!source||source.conflict||this.fingerprint(uri)!==expectedHash)throw new Error('Source changed; structural edit was not applied.');
    const previous=source.pieceById;const updated=pieces.filter(piece=>previous.has(piece.id)&&previous.get(piece.id)!.raw!==piece.raw);const added=pieces.flatMap((piece,index)=>previous.has(piece.id)?[]:[{after:index?pieces[index-1].id:null,piece}]);
    source.pieces=pieces.slice();source.pieceById=new Map(source.pieces.map(piece=>[piece.id,piece]));const removed=[...previous.keys()].filter(id=>!source.pieceById.has(id));source.version++;source.changedPieces.clear();source.dirty=serializeSource(source)!==source.rawText;source.baselineDiverged=source.dirty;this.emit('change',{kind:'pieces',uri,version:source.version,updated,added,removed});
  }
  async resolveConflict(uri: string, choice: 'reload' | 'keep') {
    const source = this.sources.get(uri)!;
    // Re-read at the time of the user's choice, rather than accepting an old snapshot.
    let latest: string | null;
    try { latest = await this.io.read(uri); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; latest = null; }
    if (choice === 'reload') {
      if (latest === null) throw new Error('The file has been deleted. Keep the editor version to recreate it.');
      this.replace(source,latest);
    } else {
      source.rawText = latest ?? ''; source.dirty = serializeSource(source) !== latest;
      source.baselineDiverged = source.dirty;
      // Retain stable piece IDs for existing undo records. A baseline diff is tracked
      // independently when the external version has a different block structure.
      source.changedPieces = new Set(source.dirty ? source.pieces.filter(p => p.kind === 'markdown').map(p => p.id) : []);
      source.deleted = latest === null; delete source.conflict;
    }
    this.emit('change',{kind:'structure',uri});
  }
  async save(uris: Iterable<string>) {
    const pending=[...uris].filter(uri=>this.sources.get(uri)?.dirty);
    // Validate the whole write set before touching any file, including known conflicts.
    for(const uri of pending)if(this.sources.get(uri)!.conflict)throw new Error(`Resolve the external conflict before saving: ${uri}`);
    for(const uri of pending){
      const source=this.sources.get(uri)!;
      let disk:string|null;try{disk=await this.io.read(uri);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;disk=null;}
      if(disk!==source.rawText && !(source.deleted && disk===null)){source.conflict={external:disk};this.emit('change',{kind:'status',uri});throw new Error(`File changed externally. No files were written: ${uri}`);}
      await this.io.validateWrite?.(uri);
    }
    const saved:string[]=[];
    for (const uri of pending) {
      const source = this.sources.get(uri)!;
      if (!source?.dirty) continue;
      try {
      if (source.conflict) throw new Error(`Resolve the external conflict before saving: ${uri}`);
      let disk: string | null;
      try { disk = await this.io.read(uri); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; disk = null; }
      if (disk !== source.rawText && !(source.deleted && disk === null)) {
        source.conflict = {external:disk}; this.emit('change',{kind:'structure',uri});
        throw new Error(`File changed externally. Save cancelled: ${uri}`);
      }
      const snapshot = serializeSource(source);
      await this.io.write(uri,snapshot);
      source.rawText = snapshot; source.dirty = serializeSource(source) !== snapshot;
      if (!source.dirty) this.markSaved(source);
      delete source.deleted;
      this.emit('change',{kind:'saved',uri});
      saved.push(uri);
      } catch(error) {
        throw new Error(`Save failed: ${uri}. Saved: ${saved.join(', ') || '(none)'}. Pending: ${pending.filter(item=>!saved.includes(item)).join(', ')}. ${String(error)}`,{cause:error});
      }
    }
  }
  private markSaved(source: SourceFileModel) {
    delete source.baselineDiverged;
    source.changedPieces.clear();
    for (const piece of source.pieces) if (piece.kind === 'markdown') piece.original = piece.raw;
  }
  async restore(uri:string,base:string,text:string) {
    let disk:string | null;
    try { disk = await this.io.read(uri); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; disk = null; }
    let source = this.sources.get(uri);
    if (source?.dirty && serializeSource(source) !== text) throw new Error('Another editor already has different unsaved changes for a restored source.');
    if (!source) {
      source = {uri,rawText:base,version:0,pieces:[],dirty:false,changedPieces:new Set(),pieceById:new Map()};
      this.sources.set(uri,source);
    }
    this.replace(source,text); source.rawText = disk === text ? text : base; source.dirty = text !== source.rawText; source.baselineDiverged = source.dirty;
    if (disk !== base && disk !== text) source.conflict = {external:disk};
    return source;
  }
}
