import MarkdownIt from 'markdown-it';
import type { SourcePiece } from '../shared/types';

// Token line maps provide block boundaries without round-tripping any Markdown.
// HTML is tokenized but never executed. Imports are recognized only at top level.
const tokenizer = new MarkdownIt({ html: true, linkify: false });
const directive = /^ {0,3}(?:@import\s+"([^"\r\n]+)"[ \t]*|<!--[ \t]*@import\s+"([^"\r\n]+)"[ \t]*-->[ \t]*)$/;
export function importPath(line: string): string | undefined {
  const match = directive.exec(line.replace(/(?:\r\n|\r|\n)$/, ''));
  return match?.[1] ?? match?.[2];
}

export function parsePieces(text: string): SourcePiece[] {
  const frontmatter = /^(?:\uFEFF)?(---|\+\+\+)[ \t]*\r?\n[\s\S]*?\r?\n\1[ \t]*(?:\r?\n|$)/.exec(text);
  if (frontmatter) {
    const raw = frontmatter[0];
    return [{kind:'markdown',id:'p0',raw,original:raw,editable:false},...parsePieces(text.slice(raw.length)).map((piece,i) => ({...piece,id:`p${i+1}`}))];
  }
  const lines = text.split(/(?<=\n)|(?<=\r)(?!\n)/);
  const offsets = [0];
  for (const line of lines) offsets.push(offsets[offsets.length - 1] + line.length);
  const tokens: ReturnType<typeof tokenizer.parse> = [];
  // Ownership needs block maps only. Parsing inline marks for multi-megabyte
  // files here would duplicate the viewport parser's work and delay first paint.
  tokenizer.block.parse(text.replace(/\r\n?/g,'\n'),tokenizer,{},tokens);
  const ranges: { start: number; end: number; type: string }[] = [];
  for (const token of tokens) {
    if (token.level === 0 && token.map && token.nesting !== -1) {
      ranges.push({start: offsets[token.map[0]], end: offsets[token.map[1]] ?? text.length, type: token.type});
    }
  }
  const pieces: SourcePiece[] = [];
  let cursor = 0;
  const addMarkdown = (raw: string, editable = true,blockType?:string) => {
    const previous=pieces[pieces.length-1];
    if(raw && !raw.trim() && previous?.kind==='markdown'){
      previous.raw+=raw;previous.original+=raw;return;
    }
    if (raw) pieces.push({kind:'markdown',id:`p${pieces.length}`,raw,original:raw,editable,blockType});
  };
  for (const range of ranges) {
    if (range.start < cursor) continue;
    addMarkdown(text.slice(cursor, range.start),!text.slice(cursor, range.start).trim());
    const raw = text.slice(range.start, range.end);
    // A paragraph may contain multiple import lines; process its individual lines.
    if (range.type === 'paragraph_open' || (range.type === 'html_block' && importPath(raw.trimEnd()) !== undefined)) {
      let pending = '';
      for (const line of raw.split(/(?<=\n)|(?<=\r)(?!\n)/)) {
        const path = importPath(line);
        if (path !== undefined) {
          addMarkdown(pending); pending = '';
          pieces.push({kind:'import',id:`p${pieces.length}`,raw:line,path});
        } else pending += line;
      }
      addMarkdown(pending, range.type !== 'html_block' && !unsupported(pending),range.type);
    } else addMarkdown(raw, range.type === 'fence' || range.type === 'code_block' || !unsupported(raw),range.type);
    cursor = range.end;
  }
  addMarkdown(text.slice(cursor),!text.slice(cursor).trim());
  if (!pieces.length) pieces.push({kind:'markdown',id:'p0',raw:'',original:'',editable:true});
  return pieces;
}

function unsupported(raw: string): boolean {
  // Preserve extensions and reference syntax that the visual serializer cannot own.
  const withoutTasks = raw.replace(/^(\s*(?:[-*+]|\d+\.)\s+)\[[ xX]\] /gm,'$1');
  return /(\[\^[^\]]+\]|\[\[[^\]]+\]\]|\$\$|^\s*\[[^\]]+\]:|\]\[[^\]]*\]|\[[^\]]+\](?!\()|<\/?[A-Za-z!][^>]*>|^\s*:::|^\s*@import\b)/m.test(withoutTasks);
}
