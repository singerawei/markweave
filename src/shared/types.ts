export interface MarkdownPiece {
  kind: 'markdown'; id: string; raw: string; original: string; editable: boolean;blockType?:string;
}
export interface ImportPiece {
  kind: 'import'; id: string; raw: string; path: string;
}
export type SourcePiece = MarkdownPiece | ImportPiece;
export interface SourceFileModel {
  uri: string; rawText: string; version: number; pieces: SourcePiece[];
  dirty: boolean; conflict?: { external: string | null }; deleted?: boolean; changedPieces: Set<string>; baselineDiverged?: boolean; pieceById: Map<string,SourcePiece>;
}
export interface Segment {
  blockType?:string;
  id: string; sourceUri: string; sourceFile: string; pieceId: string;
  includeInstanceId: string; sourceVersion: number; text: string; editable: boolean;
  error?: string;
}
export interface FileIO {
  validateWrite?(uri:string):Promise<void> | void;
  read(uri: string): Promise<string>;
  write(uri: string, text: string): Promise<void>;
  resolve(from: string, relative: string): Promise<string>;
}
export interface PieceEdit { uri: string; pieceId: string; before: string; after: string }
