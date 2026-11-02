const BOM = String.fromCharCode(0xfeff);
const FRONTMATTER = new RegExp(`^(?:${BOM})?(---|\\+\\+\\+)[ \\t]*\\r?\\n([\\s\\S]*?)\\r?\\n\\1[ \\t]*(?:\\r?\\n|$)`);

export function isFrontmatter(raw: string): boolean {
  return FRONTMATTER.test(raw);
}

export function frontmatterHtml(raw: string): string {
  const match = FRONTMATTER.exec(raw);
  if (!match) return '';
  const rows: [string, string][] = [];
  for (const line of match[2].split(/\r?\n/)) {
    const entry = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(line);
    if (!entry) continue;
    rows.push([entry[1], entry[2].trim()]);
  }
  if (!rows.length) return `<div class="frontmatter-card"><div class="frontmatter-title">Metadata</div><pre>${escape(match[2])}</pre></div>`;
  return `<div class="frontmatter-card"><div class="frontmatter-title">Metadata</div><dl>${rows.map(([key, value]) => `<dt>${escape(key)}</dt><dd>${escape(value || '—')}</dd>`).join('')}</dl></div>`;
}

function escape(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
