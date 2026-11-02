import type { MarkdownTocEntry } from './markdown';

export function markdownHeading(text: string): {level: number; text: string} | undefined {
  const atx = /^ {0,3}(#{1,6})\s+(.+?)(?:\s+#+)?\s*(?:\r?\n|$)/.exec(text);
  if (atx) return {level: atx[1].length, text: cleanInline(atx[2])};
  const setext = /^([^\r\n]+)\r?\n {0,3}(=+|-+)\s*(?:\r?\n|$)/.exec(text);
  if (setext) return {level: setext[2][0] === '=' ? 1 : 2, text: cleanInline(setext[1])};
  return undefined;
}

export function slugify(value: string): string {
  return value.trim().toLowerCase()
    .replace(/!\[\[[^\]]*\]\]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~`=^]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'section';
}

export function tocFromSegments(segments: {id: string; text: string}[]): MarkdownTocEntry[] {
  const entries: MarkdownTocEntry[] = [];
  const seen = new Map<string, number>();
  for (const segment of segments) {
    const heading = markdownHeading(segment.text);
    if (!heading) continue;
    const base = slugify(heading.text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const slug = count ? `${base}-${count + 1}` : base;
    entries.push({level: heading.level, text: heading.text, slug, segmentId: segment.id});
  }
  return entries;
}

function cleanInline(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~`=^]/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}
