import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePieces } from '../src/document/includeParser';
import { preserveEdges } from '../src/document/serializer';
import { parser, serializer } from '../src/webview/schema';

const cases = [
  '\uFEFF# 中文 😀\r\n\r\n段落 **粗体** 与 _斜体_。\r\n',
  '---\ntitle: Keep this\n---\n\n# Heading\n',
  '# Title\n\n<!-- @import "./a.md" -->\n\n* item\n  * nested\n',
  '[ref]: ./file.md "Title"\n\n[link][ref]\n',
  '<script>alert(1)</script>\n\n$$x^2$$\n\n[^note]: hi\n',
  '```typescript\nconst message = "@import";\n```\n\n| A | B |\n| :- | -: |\n| x | y |\n',
  '- [ ] task\n- [x] done\n\n~~strike~~ and `code`\n',
  'Text with no trailing newline', '', '\n\n  \r\n'
];
for (const [i,raw] of cases.entries()) test(`untouched round trip is byte identical: ${i}`,() => {
  assert.equal(parsePieces(raw).map(p => p.raw).join(''),raw);
});
for (const raw of [
  '# Title\n\nA **bold** and *italic* paragraph with ~~strike~~ and `code`.\n',
  '- [ ] task\n- [x] done\n',
  '| A | B |\n| :--- | ---: |\n| one | **two** |\n',
  '1. first\n2. second\n\n> quote\n\n```js\nconsole.log(1)\n```\n',
  '[link](./file.md) and ![alt](./image.png)\n'
]) test(`visual parse/serialize retains structure: ${raw.slice(0,30)}`,() => {
  const doc = parser.parse(raw); const serialized = serializer.serialize(doc);
  assert.deepEqual(parser.parse(serialized).toJSON(),doc.toJSON());
});
test('editing preserves CRLF and surrounding whitespace',() => {
  assert.equal(preserveEdges('\r\n  Original\r\n\r\n','New\nline'),'\r\n  New\r\nline\r\n\r\n');
});
test('unsupported extensions remain visible raw blocks',() => {
  for (const raw of ['<script>alert(1)</script>\n','See [[WikiLink]].\n','Math $$a+b$$\n','[ref]: ./file.md\n']) {
    const content = parsePieces(raw).filter(p => p.raw.trim());
    assert.ok(content.every(p => p.kind === 'markdown' && !p.editable),raw);
  }
});
test('frontmatter and reference shortcuts are protected while horizontal rules render',() => {
  const pieces = parsePieces('---\ntitle: Keep\n---\n\n---\n\nSee [reference].\n');
  assert.equal(pieces[0].kind === 'markdown' && pieces[0].editable,false);
  assert.ok(pieces.some(p => p.kind === 'markdown' && p.raw.trim() === '---' && p.editable));
  assert.ok(pieces.some(p => p.kind === 'markdown' && p.raw.includes('[reference]') && !p.editable));
});
test('edited indented code keeps code semantics',() => {
  const original = '    console.log(1)\n';
  const serialized = serializer.serialize(parser.parse(original)).replace('1','2');
  const saved = preserveEdges(original,serialized);
  assert.deepEqual(parser.parse(saved).toJSON(),parser.parse('    console.log(2)\n').toJSON());
});
