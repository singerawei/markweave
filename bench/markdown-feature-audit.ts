import { writeFile } from 'node:fs/promises';
import { parsePieces } from '../src/document/includeParser';
import { parser, serializer, markdownTokenizer } from '../src/webview/schema';

const samples: Record<string, string> = {
  'headings': '# H1\n\n## H2\n\nSetext H1\n========\n\nSetext H2\n--------\n',
  'emphasis': '**bold** *italic* ***both*** ~~strike~~ `code`\n',
  'links-inline': '[label](https://example.com "title")\n',
  'links-reference': '[label][ref]\n\n[ref]: https://example.com "title"\n',
  'autolink-angle': '<https://example.com>\n',
  'autolink-bare': 'Visit https://example.com now.\n',
  'images': '![alt](./image.png "title")\n',
  'tables': '| Left | Center | Right |\n| :--- | :---: | ---: |\n| a | b | c |\n',
  'task-list': '- [ ] todo\n- [x] done\n',
  'nested-lists': '- a\n  - b\n    1. c\n\n1. one\n2. two\n',
  'blockquote': '> quote\n>\n> > nested\n',
  'code-fence': '```ts\nconst x: number = 1;\n```\n',
  'indented-code': '    const x = 1;\n',
  'hardbreak': 'line one  \nline two\\\nline three\n',
  'thematic-break': '---\n\n***\n\n___\n',
  'entities-escapes': '&copy; \\*literal\\* \\# hash\n',
  'frontmatter': '---\ntitle: Demo\ntags: [a, b]\n---\n\n# Body\n',
  'footnotes': 'Text[^1]\n\n[^1]: Note text.\n',
  'definition-list': 'Term\n: Definition\n',
  'math-inline': 'Euler: $e^{i\\pi}+1=0$\n',
  'math-block': '$$\n\\int_0^1 x^2 dx\n$$\n',
  'highlight': '==highlighted==\n',
  'sub-sup': 'H~2~O and x^2^\n',
  'emoji-shortcode': 'Hello :smile: :rocket:\n',
  'wiki-link': 'See [[Wiki Page]].\n',
  'callout': '> [!NOTE]\n> Useful information.\n',
  'admonition': '!!! note\n    Useful information.\n',
  'html-inline': 'Text with <kbd>Ctrl</kbd> and <mark>mark</mark>.\n',
  'html-block': '<details>\n<summary>More</summary>\n\nHidden text\n\n</details>\n',
  'toc': '[TOC]\n\n# Section\n',
  'anchor-link': '[jump](#section)\n\n## Section\n',
  'abbreviation': '*[HTML]: HyperText Markup Language\n\nHTML is useful.\n',
  'mermaid': '```mermaid\nflowchart LR\n A --> B\n```\n',
  'comments': '%% hidden comment %%\n\nVisible text.\n',
  'html-comment': '<!-- comment -->\n\nVisible text.\n',
};

const output: any[] = [];
for (const [name, markdown] of Object.entries(samples)) {
  const pieces = parsePieces(markdown);
  const visible = pieces.filter(piece => piece.raw.trim());
  const editable = visible.every(piece => piece.kind === 'markdown' && piece.editable);
  let roundTrip = false;
  let nodeTypes: string[] = [];
  let error: string | undefined;
  try {
    const doc = parser.parse(markdown);
    const serialized = serializer.serialize(doc);
    roundTrip = JSON.stringify(parser.parse(serialized).toJSON()) === JSON.stringify(doc.toJSON());
    doc.descendants(node => { if (node.isBlock) nodeTypes.push(node.type.name); });
    nodeTypes = [...new Set(nodeTypes)];
  } catch (reason) {
    error = String(reason);
  }
  const html = markdownTokenizer(true).render(markdown);
  output.push({
    name,
    editable,
    visiblePieces: visible.map(piece => ({kind: piece.kind, editable: piece.kind === 'markdown' ? piece.editable : false, type: piece.kind === 'markdown' ? piece.blockType : undefined})),
    roundTrip,
    nodeTypes,
    error,
    html
  });
}
async function main() {
  await writeFile('bench/results/markdown-coverage.json', JSON.stringify(output, null, 2) + '\n');
  for (const row of output) {
    console.log(`${row.name.padEnd(18)} editable=${String(row.editable).padEnd(5)} roundTrip=${String(row.roundTrip).padEnd(5)} nodes=${row.nodeTypes.join(',')}`);
    console.log(`  pieces=${row.visiblePieces.map((piece: any) => `${piece.kind}${piece.type ? `(${piece.type})` : ''}${piece.editable ? '' : '*'}`).join(', ')}`);
    console.log(`  html=${row.html.replace(/\n/g, '\\n').slice(0, 220)}`);
  }
}
void main();
