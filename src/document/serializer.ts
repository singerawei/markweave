import type { SourceFileModel } from '../shared/types';
export function serializeSource(source: SourceFileModel): string {
  return source.pieces.map(piece => piece.raw).join('');
}
export function preserveEdges(original: string, serialized: string): string {
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  // Retain indented-code semantics instead of indenting newly generated fences.
  if (/^(?: {4}|\t)\S/.test(original) && /^```[^\n]*\n[\s\S]*\n```$/.test(serialized.trim())) {
    const body = serialized.trim().replace(/^```[^\n]*\n/,'').replace(/\n```$/,'');
    return body.split('\n').map(line => '    '+line).join(eol) + (/\s*$/.exec(original)?.[0].replace(/^ +/,'') ?? '');
  }
  const leading = /^\s*/.exec(original)?.[0] ?? '';
  const trailing = /\s*$/.exec(original)?.[0] ?? '';
  return leading + serialized.trim().replace(/\r?\n/g, eol) + (original.trim() ? trailing : eol);
}
