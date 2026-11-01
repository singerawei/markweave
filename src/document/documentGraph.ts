import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Segment } from '../shared/types';
import { SourceRepository } from './sourceFile';

export class DocumentGraph {
  readonly dependencies = new Map<string, Set<string>>();
  readonly sourceUris = new Set<string>();
  readonly duplicates = new Set<string>();
  segments: Segment[] = [];
  constructor(readonly repository: SourceRepository, readonly rootUri: string) {}
  async build(maxSegments = Infinity) {
    this.segments = []; this.dependencies.clear(); this.sourceUris.clear(); this.duplicates.clear();
    // Bound expansion as well as depth: a DAG can otherwise expand exponentially.
    let count = 0;
    const visit = async (uri: string, stack: string[], instance: string): Promise<void> => {
      if (this.segments.length >= maxSegments) return;
      if (++count > 10000 || stack.length > 128) {
        this.error(uri,instance,'Include expansion limit reached (10,000 instances / 128 levels).'); return;
      }
      if (stack.includes(uri)) { this.error(uri,instance,`Circular include detected:\n${[...stack,uri].join('\n→ ')}`); return; }
      if (this.sourceUris.has(uri)) this.duplicates.add(uri);
      this.sourceUris.add(uri);
      let source;
      try { source = await this.repository.load(uri); }
      catch (error) { this.error(uri,instance,`Cannot read Markdown: ${String(error)}`); return; }
      if (source.deleted) { this.error(uri,instance,'Source file was deleted externally.'); return; }
      const edges = this.dependencies.get(uri) ?? new Set<string>();
      this.dependencies.set(uri,edges);
      for (const piece of source.pieces) {
        if (this.segments.length >= maxSegments) break;
        if (piece.kind === 'import') {
          try {
            const target = await this.repository.io.resolve(uri,piece.path);
            edges.add(target);
            await visit(target,[...stack,uri],`${instance}/${piece.id}`);
          } catch (error) { this.error(uri,`${instance}/${piece.id}`,String(error)); }
        } else if (piece.raw.trim() || source.pieces.length === 1) {
          this.segments.push({ id:`${instance}:${piece.id}`,sourceUri:uri,sourceFile:basename(fileURLToPath(uri)),pieceId:piece.id,blockType:piece.blockType,
            includeInstanceId:instance,sourceVersion:source.version,text:piece.raw,editable:piece.editable });
        }
      }
    };
    await visit(this.rootUri,[],'root');
    return this.segments;
  }
  private error(uri: string, id: string, error: string) {
    this.segments.push({id:`${id}:error`,sourceUri:uri,sourceFile:uri,pieceId:'',includeInstanceId:id,sourceVersion:0,text:'',editable:false,error});
  }
}
