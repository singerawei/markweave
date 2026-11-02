import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  markdownTokenizer,
  collectReferences,
  collectAbbreviations,
  type MarkdownEnv
} from '../src/shared/markdown';
import { tocFromSegments } from '../src/shared/headings';
import { frontmatterHtml, isFrontmatter } from '../src/shared/frontmatter';
import { parsePieces } from '../src/document/includeParser';
import { parser, serializer } from '../src/webview/schema';

const md = markdownTokenizer(true);

test('GFM autolinks and cross-block reference links render', () => {
  const references = collectReferences(['[ref]: https://example.com "Title"\n']);
  assert.match(md.render('[label][ref]', {references} as MarkdownEnv), /href="https:\/\/example\.com"/);
  assert.match(md.render('Visit https://example.com now.', {}), /<a href="https:\/\/example\.com">/);
  assert.match(md.render('<https://example.com>', {}), /<a href="https:\/\/example\.com">/);
});

test('footnotes, alerts, admonitions and definition lists render', () => {
  const footnotes = md.render('Text[^1]\n\n[^1]: Note body.\n');
  assert.match(footnotes, /footnote-ref/);
  assert.match(footnotes, /footnote-def/);
  assert.match(footnotes, /Note body/);
  const alert = md.render('> [!WARNING] Custom title\n> Careful.\n');
  assert.match(alert, /md-alert-warning/);
  assert.match(alert, /data-title="Custom title"/);
  assert.match(md.render('> [!NOTE]-\n> folded\n'), /<details class="md-alert[^"]*"><summary>Note<\/summary>/);
  assert.match(md.render('> [!TIP]+\n> open\n'), /<details class="md-alert[^"]*" open><summary>Tip<\/summary>/);
  assert.match(md.render('!!! tip "Hint"\n    Body\n'), /admonition-tip/);
  assert.match(md.render('Term\n: Definition\n'), /<dl>[\s\S]*<dt>Term<\/dt>[\s\S]*<dd>Definition<\/dd>/);
});

test('details blocks keep Markdown inside them', () => {
  const html = md.render('<details>\n<summary>More</summary>\n\n**bold** content\n\n</details>');
  assert.match(html, /<details><summary>More<\/summary>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<\/details>/);
  assert.ok(html.indexOf('<strong>bold</strong>') < html.indexOf('</details>'));
});

test('math, highlight, sub/sup, emoji and TOC render', () => {
  assert.match(md.render('$e^{i\\pi}+1=0$'), /<math/);
  assert.match(md.render('$$\nx^2\n$$'), /math-block/);
  assert.match(md.render('\\(x^2\\)'), /<math/);
  assert.match(md.render('\\[\nx^2\n\\]'), /math-block/);
  assert.match(md.render('==**bold**=='), /<mark><strong>bold<\/strong><\/mark>/);
  assert.match(md.render('==highlight== H~2~O x^2^ :smile:'), /<mark>highlight<\/mark>/);
  assert.match(md.render('H~2~O'), /H<sub>2<\/sub>O/);
  assert.match(md.render('x^2^'), /x<sup>2<\/sup>/);
  assert.match(md.render('H~**2**~O'), /H<sub><strong>2<\/strong><\/sub>O/);
  assert.match(md.render(':rocket:'), /🚀/);
  const toc = tocFromSegments([{id: 'a', text: '# One\n'}, {id: 'b', text: '## Two\n'}]);
  const rendered = md.render('[TOC]', {toc} as MarkdownEnv);
  assert.match(rendered, /md-toc/);
  assert.match(rendered, /data-toc-segment="b"/);
});

test('wikilinks, comments and abbreviations render', () => {
  assert.match(md.render('[[Page|Label]]'), /data-wikilink="Page"/);
  assert.match(md.render('![[Page]]'), /md-embed/);
  assert.match(md.render('%%hidden%%'), /md-comment/);
  assert.match(md.render('%%\nhidden\n%%'), /md-comment-block/);
  const abbreviations = collectAbbreviations(['*[API]: Application Programming Interface\n']);
  assert.match(md.render('API works', {abbreviations} as MarkdownEnv), /<abbr title="Application Programming Interface">API<\/abbr>/);
});

test('safe HTML allows presentation tags but strips scripts, event handlers and unsafe URLs', () => {
  assert.match(md.render('<kbd>Ctrl</kbd>'), /<kbd>Ctrl<\/kbd>/);
  assert.match(md.render('<details><summary>More</summary>Hidden</details>'), /<details>/);
  const unsafe = md.render('<img src="x" onerror="alert(1)"><a href="javascript:alert(1)">x</a><script>alert(1)</script>');
  assert.doesNotMatch(unsafe, /onerror/i);
  assert.doesNotMatch(unsafe, /javascript:/i);
  assert.doesNotMatch(unsafe, /<script/i);
});

test('frontmatter is recognized and rendered as a metadata card', () => {
  const raw = '---\ntitle: Demo\ntags: [a, b]\n---\n\n# Body\n';
  assert.equal(isFrontmatter(raw), true);
  const html = frontmatterHtml(raw);
  assert.match(html, /frontmatter-card/);
  assert.match(html, /<dt>title<\/dt><dd>Demo<\/dd>/);
});

test('highlight, subscript and superscript remain editable and round-trip', () => {
  const raw = '==highlight== H~2~O x^2^ and **bold**\n';
  const doc = parser.parse(raw);
  const out = serializer.serialize(doc);
  assert.deepEqual(parser.parse(out).toJSON(), doc.toJSON());
  assert.match(out, /==highlight==/);
  assert.match(out, /H~2~O/);
  assert.match(out, /x\^2\^/);
});

test('complex extensions are source-backed but rich-rendered', () => {
  for (const raw of ['$x^2$\n', '[^1]: note\n', '> [!NOTE]\n> body\n', '[[Page]]\n', '%%comment%%\n', '*[API]: Title\n']) {
    const pieces = parsePieces(raw).filter(piece => piece.raw.trim());
    assert.ok(pieces.every(piece => piece.kind === 'markdown' && !piece.editable), raw);
  }
});
