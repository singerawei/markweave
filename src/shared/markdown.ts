import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';
import katex from 'katex';
import deflist from 'markdown-it-deflist';
import {full as emoji} from 'markdown-it-emoji';

export interface MarkdownTocEntry {
  level: number;
  text: string;
  slug: string;
  segmentId?: string;
}

export interface MarkdownEnv {
  references?: Record<string, {href: string; title: string}>;
  toc?: MarkdownTocEntry[];
  abbreviations?: Record<string, string>;
  [key: string | symbol]: unknown;
}

const SAFE_HTML: sanitizeHtml.IOptions = {
  allowedTags: [
    'a','abbr','b','blockquote','br','caption','cite','code','dd','del','details','div','dl','dt',
    'em','figcaption','figure','h1','h2','h3','h4','h5','h6','hr','i','img','ins','kbd','li','mark',
    'ol','p','pre','q','s','small','span','strong','sub','summary','sup','table','tbody','td','tfoot',
    'th','thead','tr','u','ul'
  ],
  allowedAttributes: {
    '*': ['class','id','title','href','src','alt','width','height','loading'],
  },
  allowedSchemes: ['http','https','mailto','data','tel'],
  allowedSchemesByTag: {img: ['http','https','data']},
  allowProtocolRelative: true,
  transformTags: {
    a: (tagName, attribs) => ({tagName, attribs: {...attribs, rel: 'noopener noreferrer'}}),
    img: (tagName, attribs) => ({tagName, attribs: {...attribs, loading: 'lazy'}}),
  },
};

/** Sanitize an already-rendered HTML fragment with the same allowlist. */
export function sanitizeHtmlFragment(html: string) {
  return sanitizeHtml(html, SAFE_HTML);
}

export function footnoteAnchor(id: string) {
  return id.replace(/[^A-Za-z0-9_-]/g, '_');
}

/**
 * Collect Markdown reference definitions across separately rendered blocks.
 * markdown-it stores normalized (upper-cased) labels in `env.references`.
 */
export function collectReferences(texts: Iterable<string>): Record<string, {href: string; title: string}> {
  const parser = new MarkdownIt({html: true, linkify: false});
  const env: MarkdownEnv = {};
  for (const text of texts) {
    if (text.includes(']:')) parser.parse(text, env);
  }
  return (env.references ?? {}) as Record<string, {href: string; title: string}>;
}

export function collectAbbreviations(texts: Iterable<string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const text of texts) {
    for (const line of text.split(/\r?\n/)) {
      const match = /^\*\[([^\]]+)\]:[ \t]*(.*)$/.exec(line);
      if (match) result[match[1]] = match[2].trim();
    }
  }
  return result;
}

function renderMath(tex: string, displayMode: boolean) {
  try {
    return katex.renderToString(tex, {displayMode, throwOnError: false, output: 'mathml', strict: 'ignore'});
  } catch (error) {
    return `<code class="math-error" title="${escapeHtml(String(error))}">${escapeHtml(tex)}</code>`;
  }
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const INLINE_HTML_TAGS = new Set(['a','abbr','b','br','cite','code','del','details','em','i','img','ins','kbd','mark','q','s','small','span','strong','sub','summary','sup','u']);
const VOID_HTML_TAGS = new Set(['br','hr','img']);
function sanitizeInlineTag(raw: string) {
  if (raw.startsWith('<!--')) return '';
  const match = /^<\s*(\/?)\s*([A-Za-z][\w-]*)([^>]*?)(\/?)\s*>$/.exec(raw);
  if (!match) return sanitizeHtml(raw, SAFE_HTML);
  const [, closing, rawTag, attrs, selfClosing] = match;
  const tag = rawTag.toLowerCase();
  if (!INLINE_HTML_TAGS.has(tag)) return '';
  if (closing) return `</${tag}>`;
  if (VOID_HTML_TAGS.has(tag)) return sanitizeHtml(raw, SAFE_HTML);
  const opening = `<${tag}${attrs}${selfClosing}>`;
  const sanitized = sanitizeHtml(opening + `</${tag}>`, SAFE_HTML);
  const end = sanitized.indexOf('>');
  return end >= 0 ? sanitized.slice(0, end + 1) : '';
}

function titleCase(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1).toLowerCase();
}

function mathParenInline(state: any, silent: boolean) {
  const start = state.pos;
  if (!state.src.startsWith('\\(', start)) return false;
  if (start > 0 && state.src[start - 1] === '\\') return false;
  let end = start + 2;
  while (end < state.src.length) {
    if (state.src.startsWith('\\)', end)) break;
    if (state.src[end] === '\n') return false;
    end++;
  }
  if (end >= state.src.length) return false;
  const content = state.src.slice(start + 2, end).trim();
  if (!content) return false;
  if (silent) return true;
  const token = state.push('math_inline', 'math', 0);
  token.content = content;
  token.markup = '\\(';
  state.pos = end + 2;
  return true;
}

function mathBracketBlock(state: any, startLine: number, endLine: number, silent: boolean) {
  const lineText = (line: number) => state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]);
  const first = lineText(startLine).trim();
  if (!first.startsWith('\\[')) return false;
  const lines: string[] = [];
  let nextLine = startLine + 1;
  const sameLine = first.indexOf('\\]');
  if (sameLine >= 0) {
    lines.push(first.slice(2, sameLine));
  } else {
    const initial = first.slice(2).trim();
    if (initial) lines.push(initial);
    let found = false;
    for (let line = startLine + 1; line < endLine; line++) {
      const text = lineText(line);
      const close = text.indexOf('\\]');
      if (close >= 0) {
        if (text.slice(0, close).trim()) lines.push(text.slice(0, close));
        found = true;
        nextLine = line + 1;
        break;
      }
      lines.push(text);
    }
    if (!found) return false;
  }
  const content = lines.join('\n').trim();
  if (!content) return false;
  if (silent) return true;
  const token = state.push('math_block', 'math', 0);
  token.content = content;
  token.markup = '\\[';
  token.map = [startLine, nextLine];
  state.line = nextLine;
  return true;
}

function mathInline(state: any, silent: boolean) {
  const start = state.pos;
  if (state.src.charCodeAt(start) !== 0x24 || state.src.charCodeAt(start + 1) === 0x24) return false;
  if (start > 0 && state.src[start - 1] === '\\') return false;
  let end = start + 1;
  while (end < state.src.length) {
    const char = state.src[end];
    if (char === '\n') return false;
    if (char === '\\') { end += 2; continue; }
    if (char === '$') break;
    end++;
  }
  if (end >= state.src.length || end === start + 1) return false;
  const content = state.src.slice(start + 1, end).trim();
  if (!content || /^\s|\s$/.test(state.src.slice(start + 1, end))) return false;
  if (silent) return true;
  const token = state.push('math_inline', 'math', 0);
  token.content = content;
  token.markup = '$';
  state.pos = end + 1;
  return true;
}

function mathBlock(state: any, startLine: number, endLine: number, silent: boolean) {
  const lineText = (line: number) => state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]);
  const first = lineText(startLine).trim();
  if (!first.startsWith('$$')) return false;
  let content: string;
  let nextLine = startLine + 1;
  if (first.length > 3 && first.endsWith('$$')) {
    content = first.slice(2, -2).trim();
  } else {
    const lines: string[] = [];
    const initial = first.slice(2).trim();
    if (initial) lines.push(initial);
    let found = false;
    for (let line = startLine + 1; line < endLine; line++) {
      const text = lineText(line);
      const close = text.indexOf('$$');
      if (close >= 0) {
        if (text.slice(0, close).trim()) lines.push(text.slice(0, close));
        found = true;
        nextLine = line + 1;
        break;
      }
      lines.push(text);
    }
    if (!found) return false;
    content = lines.join('\n').trim();
  }
  if (!content) return false;
  if (silent) return true;
  const token = state.push('math_block', 'math', 0);
  token.content = content;
  token.markup = '$$';
  token.map = [startLine, nextLine];
  state.line = nextLine;
  return true;
}

function pairRule(openType: string, closeType: string, marker: string, rejectDouble = '') {
  return (state: any, silent: boolean) => {
    const start = state.pos;
    if (state.src.slice(start, start + marker.length) !== marker) return false;
    if (start > 0 && state.src[start - 1] === '\\') return false;
    if (rejectDouble && state.src.slice(start, start + rejectDouble.length) === rejectDouble) return false;
    let end = start + marker.length;
    while (end < state.src.length) {
      if (state.src[end] === '\n') return false;
      if (state.src.slice(end, end + marker.length) === marker && state.src[end - 1] !== '\\') break;
      end++;
    }
    if (end >= state.src.length || end === start + marker.length) return false;
    if (rejectDouble && state.src.slice(end, end + rejectDouble.length) === rejectDouble) return false;
    if (silent) return true;
    const content = state.src.slice(start + marker.length, end);
    const tag = marker === '==' ? 'mark' : marker === '^' ? 'sup' : 'sub';
    state.push(openType, tag, 1);
    const inner: any[] = [];
    state.md.inline.parse(content, state.md, state.env, inner);
    state.tokens.push(...inner);
    state.push(closeType, tag, -1);
    state.pos = end + marker.length;
    return true;
  };
}

function footnoteRef(state: any, silent: boolean) {
  const start = state.pos;
  if (!state.src.startsWith('[^', start)) return false;
  const match = /^\[\^([^\]\s]+)\]/.exec(state.src.slice(start));
  if (!match) return false;
  if (silent) return true;
  const token = state.push('footnote_ref', '', 0);
  token.content = match[1];
  token.meta = {id: match[1]};
  state.pos = start + match[0].length;
  return true;
}

function footnoteDefinition(state: any, startLine: number, endLine: number, silent: boolean) {
  const lineText = (line: number) => state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]);
  const match = /^\[\^([^\]\s]+)\]:[ \t]*(.*)$/.exec(lineText(startLine));
  if (!match) return false;
  if (silent) return true;
  let line = startLine + 1;
  const body = [match[2]];
  while (line < endLine) {
    const text = lineText(line);
    if (!text.trim()) { body.push(''); line++; continue; }
    if ((state.sCount[line] ?? 0) < 2) break;
    body.push(text.replace(/^\s{1,4}/, ''));
    line++;
  }
  const token = state.push('footnote_definition', 'div', 0);
  token.content = body.join('\n').trim();
  token.meta = {id: match[1]};
  token.map = [startLine, line];
  state.line = line;
  return true;
}

function tocBlock(state: any, startLine: number, endLine: number, silent: boolean) {
  const text = state.src.slice(state.bMarks[startLine] + state.tShift[startLine], state.eMarks[startLine]).trim();
  if (!/^\[toc\]$/i.test(text)) return false;
  if (silent) return true;
  state.push('toc', 'nav', 0);
  state.line = startLine + 1;
  return true;
}

function abbreviationBlock(state: any, startLine: number, endLine: number, silent: boolean) {
  const text = state.src.slice(state.bMarks[startLine] + state.tShift[startLine], state.eMarks[startLine]);
  const match = /^\*\[([^\]]+)\]:[ \t]*(.*)$/.exec(text);
  if (!match) return false;
  if (silent) return true;
  state.env.abbreviations ??= {};
  state.env.abbreviations[match[1]] = match[2].trim();
  state.line = startLine + 1;
  return true;
}

function abbreviationRule(state: any) {
  const abbreviations: Record<string, string> = state.env.abbreviations ?? {};
  const names = Object.keys(abbreviations).sort((a, b) => b.length - a.length);
  if (!names.length) return;
  const pattern = new RegExp(`\\b(${names.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'g');
  for (const inline of state.tokens) {
    if (inline.type !== 'inline' || !inline.children) continue;
    for (let index = 0; index < inline.children.length; index++) {
      const token = inline.children[index];
      if (token.type !== 'text' || !token.content) continue;
      const parts: {text: string; name?: string}[] = [];
      let cursor = 0;
      for (const match of token.content.matchAll(pattern)) {
        const start = match.index ?? 0;
        if (start > cursor) parts.push({text: token.content.slice(cursor, start)});
        parts.push({text: match[0], name: match[0]});
        cursor = start + match[0].length;
      }
      if (!parts.length) continue;
      if (cursor < token.content.length) parts.push({text: token.content.slice(cursor)});
      const replacement: any[] = [];
      for (const part of parts) {
        if (part.name) {
          const abbr = new state.Token('abbr_inline', 'abbr', 0);
          abbr.content = part.name;
          abbr.meta = {title: abbreviations[part.name]};
          replacement.push(abbr);
        } else if (part.text) {
          const text = new state.Token('text', '', 0);
          text.content = part.text;
          replacement.push(text);
        }
      }
      inline.children.splice(index, 1, ...replacement);
      index += replacement.length - 1;
    }
  }
}

function detailsBlock(state: any, startLine: number, endLine: number, silent: boolean) {
  const lineText = (line: number) => state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]);
  const first = lineText(startLine).trim();
  if (!/^<details(?:\s[^>]*)?>/i.test(first)) return false;
  const startOffset = state.bMarks[startLine] + state.tShift[startLine];
  const closeOffset = state.src.indexOf('</details>', startOffset);
  if (closeOffset < 0) return false;
  let nextLine = startLine;
  while (nextLine < endLine && state.eMarks[nextLine] < closeOffset + 10) nextLine++;
  if (nextLine < endLine) nextLine++;
  const raw = state.src.slice(startOffset, closeOffset + '</details>'.length);
  if (silent) return true;
  const inner = raw.replace(/^<details[^>]*>/i, '').replace(/<\/details>\s*$/i, '');
  const summaryMatch = /<summary[^>]*>([\s\S]*?)<\/summary>/i.exec(inner);
  const summary = summaryMatch ? state.md.renderInline(summaryMatch[1]) : 'Details';
  const body = summaryMatch ? inner.replace(summaryMatch[0], '') : inner;
  const token = state.push('details_block', 'details', 0);
  token.content = state.md.render(body.trim(), state.env);
  token.meta = {summary, open: /^<details[^>]*\bopen\b/i.test(raw)};
  token.map = [startLine, nextLine];
  state.line = nextLine;
  return true;
}

function admonitionBlock(state: any, startLine: number, endLine: number, silent: boolean) {
  const lineText = (line: number) => state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]);
  const match = /^!!!\s+([A-Za-z][\w-]*)(?:\s+"([^"]*)")?\s*$/.exec(lineText(startLine));
  if (!match) return false;
  if (silent) return true;
  const body: string[] = [];
  let line = startLine + 1;
  while (line < endLine) {
    const text = lineText(line);
    if (!text.trim()) { body.push(''); line++; continue; }
    if ((state.sCount[line] ?? 0) < 2) break;
    body.push(text.replace(/^\s{1,4}/, ''));
    line++;
  }
  const token = state.push('admonition', 'div', 0);
  token.content = body.join('\n').trim();
  token.meta = {type: match[1].toLowerCase(), title: match[2] || titleCase(match[1])};
  token.map = [startLine, line];
  state.line = line;
  return true;
}

function wikilinkInline(state: any, silent: boolean) {
  const start = state.pos;
  const embed = state.src.startsWith('![[', start);
  if (!embed && !state.src.startsWith('[[', start)) return false;
  const open = embed ? '![[' : '[[';
  const match = /^!?\[\[([^\]\r\n|]+)(?:\|([^\]\r\n]+))?\]\]/.exec(state.src.slice(start));
  if (!match) return false;
  if (silent) return true;
  const token = state.push(embed ? 'wikilink_embed' : 'wikilink', embed ? 'span' : 'a', 0);
  token.content = match[1].trim();
  token.meta = {target: match[1].trim(), label: (match[2] ?? match[1]).trim()};
  token.markup = open.trim();
  state.pos = start + match[0].length;
  return true;
}

function commentInline(state: any, silent: boolean) {
  const start = state.pos;
  if (!state.src.startsWith('%%', start)) return false;
  const end = state.src.indexOf('%%', start + 2);
  if (end < 0 || state.src.slice(start + 2, end).includes('\n')) return false;
  if (silent) return true;
  const token = state.push('comment_inline', 'span', 0);
  token.content = state.src.slice(start + 2, end);
  state.pos = end + 2;
  return true;
}

function commentBlock(state: any, startLine: number, endLine: number, silent: boolean) {
  const lineText = (line: number) => state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]);
  if (lineText(startLine).trim() !== '%%') return false;
  let line = startLine + 1;
  while (line < endLine && lineText(line).trim() !== '%%') line++;
  if (line >= endLine) return false;
  if (silent) return true;
  const token = state.push('comment_block', 'div', 0);
  token.content = lineText(startLine + 1);
  token.map = [startLine, line + 1];
  state.line = line + 1;
  return true;
}

function alertRule(state: any) {
  const tokens = state.tokens;
  for (let index = 0; index < tokens.length; index++) {
    const open = tokens[index];
    if (open.type !== 'blockquote_open') continue;
    let inline: any;
    for (let cursor = index + 1; cursor < tokens.length && tokens[cursor].type !== 'blockquote_close'; cursor++) {
      if (tokens[cursor].type === 'inline') { inline = tokens[cursor]; break; }
    }
    if (!inline) continue;
    const match = /^\s*\[!([A-Za-z][\w-]*)\]([+-]?)(?:[ \t]+([^\n]*))?/.exec(inline.content);
    if (!match) continue;
    const type = match[1].toLowerCase();
    const custom = (match[3] ?? '').trim();
    const consumed = match[0].length;
    const title = custom || titleCase(type);
    open.attrSet('class', `md-alert md-alert-${type}`);
    open.attrSet('data-title', title);
    open.attrSet('data-alert-type', type);
    if (match[2]) {
      open.attrSet('data-fold', match[2]);
      open.type = 'alert_fold_open';
      open.tag = 'details';
      let depth = 0;
      for (let cursor = index; cursor < tokens.length; cursor++) {
        if (tokens[cursor].type === 'blockquote_open' || tokens[cursor].type === 'alert_fold_open') depth++;
        else if (tokens[cursor].type === 'blockquote_close' || tokens[cursor].type === 'alert_fold_close') {
          depth--;
          if (depth === 0) { tokens[cursor].type = 'alert_fold_close'; tokens[cursor].tag = 'details'; break; }
        }
      }
    }
    inline.content = inline.content.slice(consumed).replace(/^\r?\n/, '');
    const first = inline.children?.[0];
    if (first?.type === 'text') first.content = first.content.slice(consumed).replace(/^\r?\n/, '');
  }
}

export function markdownTokenizer(html = false) {
  const md = new MarkdownIt({html, linkify: true, breaks: false, typographer: false});
  md.use(deflist);
  md.use(emoji);

  md.inline.ruler.before('escape', 'md_math_paren', mathParenInline);
  md.inline.ruler.before('emphasis', 'md_math_inline', mathInline);
  md.inline.ruler.before('emphasis', 'md_mark', pairRule('mark_open', 'mark_close', '=='));
  md.inline.ruler.before('emphasis', 'md_sub', pairRule('sub_open', 'sub_close', '~', '~~'));
  md.inline.ruler.before('emphasis', 'md_sup', pairRule('sup_open', 'sup_close', '^'));
  md.inline.ruler.before('link', 'md_footnote_ref', footnoteRef);
  md.inline.ruler.before('link', 'md_wikilink', wikilinkInline);
  md.inline.ruler.before('emphasis', 'md_comment_inline', commentInline);

  md.block.ruler.before('fence', 'md_math_block', mathBlock, {alt: ['paragraph', 'reference', 'blockquote', 'list']});
  md.block.ruler.before('fence', 'md_math_bracket_block', mathBracketBlock, {alt: ['paragraph', 'reference', 'blockquote', 'list']});
  md.block.ruler.before('reference', 'md_footnote_definition', footnoteDefinition, {alt: ['paragraph', 'reference']});
  md.block.ruler.before('html_block', 'md_details', detailsBlock, {alt: ['paragraph']});
  md.block.ruler.before('paragraph', 'md_toc', tocBlock, {alt: ['paragraph']});
  md.block.ruler.before('paragraph', 'md_abbreviation', abbreviationBlock, {alt: ['paragraph']});
  md.block.ruler.before('paragraph', 'md_admonition', admonitionBlock, {alt: ['paragraph']});
  md.block.ruler.before('paragraph', 'md_comment_block', commentBlock, {alt: ['paragraph']});
  md.core.ruler.after('emoji', 'md_emoji_text', state => {
    for (const token of state.tokens) {
      if (token.type !== 'inline' || !token.children) continue;
      for (const child of token.children) {
        if (child.type === 'emoji') child.type = 'text';
      }
    }
  });
  md.core.ruler.after('inline', 'md_alerts', alertRule);
  md.core.ruler.after('inline', 'md_abbreviations', abbreviationRule);

  if (!md.renderer.rules) md.renderer.rules = {};
  const rules = md.renderer.rules;
  rules.math_inline = (tokens, index) => renderMath(tokens[index].content, false);
  rules.math_block = (tokens, index) => `<div class="math-block">${renderMath(tokens[index].content, true)}</div>\n`;
  rules.mark_open = () => '<mark>';
  rules.mark_close = () => '</mark>';
  rules.sub_open = () => '<sub>';
  rules.sub_close = () => '</sub>';
  rules.sup_open = () => '<sup>';
  rules.sup_close = () => '</sup>';

  rules.footnote_ref = (tokens, index) => {
    const id = footnoteAnchor(String(tokens[index].meta?.id ?? tokens[index].content));
    return `<sup class="footnote-ref"><a href="#fn-${escapeHtml(id)}" id="fnref-${escapeHtml(id)}" data-footnote="${escapeHtml(id)}">${escapeHtml(String(tokens[index].meta?.id ?? tokens[index].content))}</a></sup>`;
  };
  rules.footnote_definition = (tokens, index) => {
    const token = tokens[index];
    const id = footnoteAnchor(String(token.meta?.id ?? ''));
    return `<div class="footnote-def" id="fn-${escapeHtml(id)}"><span class="footnote-label">${escapeHtml(String(token.meta?.id ?? ''))}.</span><div class="footnote-body">${md.render(token.content)}</div></div>\n`;
  };
  rules.toc = (_tokens, _index, _options, env: any) => {
    const entries: MarkdownTocEntry[] = env?.toc ?? [];
    if (!entries.length) return '<nav class="md-toc md-toc-empty" data-toc="true"></nav>\n';
    const items = entries.map(entry => {
      const target = entry.segmentId ? `#segment-${encodeURIComponent(entry.segmentId)}` : `#${encodeURIComponent(entry.slug)}`;
      const attr = entry.segmentId ? ` data-toc-segment="${escapeHtml(entry.segmentId)}"` : '';
      return `<li class="md-toc-level-${entry.level}"><a href="${target}"${attr}>${escapeHtml(entry.text)}</a></li>`;
    }).join('');
    return `<nav class="md-toc" aria-label="Table of contents"><div class="md-toc-title">Contents</div><ul>${items}</ul></nav>\n`;
  };
  rules.wikilink = (tokens, index) => {
    const meta = tokens[index].meta ?? {};
    return `<a class="md-wikilink" href="#wikilink-${encodeURIComponent(String(meta.target ?? ''))}" data-wikilink="${escapeHtml(String(meta.target ?? ''))}">${escapeHtml(String(meta.label ?? meta.target ?? ''))}</a>`;
  };
  rules.wikilink_embed = (tokens, index) => {
    const meta = tokens[index].meta ?? {};
    return `<span class="md-embed" data-wikilink="${escapeHtml(String(meta.target ?? ''))}" title="Click to open ${escapeHtml(String(meta.target ?? ''))}">${escapeHtml(String(meta.label ?? meta.target ?? ''))}</span>`;
  };
  rules.abbr_inline = (tokens, index) => `<abbr title="${escapeHtml(String(tokens[index].meta?.title ?? ''))}">${escapeHtml(tokens[index].content)}</abbr>`;
  rules.details_block = (tokens, index) => {
    const token = tokens[index];
    return `<details${token.meta?.open ? ' open' : ''}><summary>${token.meta?.summary ?? 'Details'}</summary>${token.content}</details>\n`;
  };
  rules.comment_inline = () => '<span class="md-comment" title="Hidden comment" aria-label="Hidden comment"></span>';
  rules.comment_block = () => '<div class="md-comment-block" title="Hidden comment" aria-label="Hidden comment"></div>\n';
  rules.admonition = (tokens, index) => {
    const token = tokens[index];
    const meta = token.meta ?? {};
    return `<div class="admonition admonition-${escapeHtml(String(meta.type ?? 'note'))}"><div class="admonition-title">${escapeHtml(String(meta.title ?? 'Note'))}</div><div class="admonition-body">${md.render(token.content)}</div></div>\n`;
  };

  const defaultBlockquote = rules.blockquote_open;
  rules.blockquote_open = (tokens, index, options, env, self) => {
    const cls = String(tokens[index].attrGet('class') ?? '');
    if (cls.includes('md-alert')) {
      const title = String(tokens[index].attrGet('data-title') ?? '');
      return `<blockquote class="${escapeHtml(cls)}" data-title="${escapeHtml(title)}">\n`;
    }
    return defaultBlockquote ? defaultBlockquote(tokens, index, options, env, self) : '<blockquote>\n';
  };
  rules.alert_fold_open = (tokens, index) => {
    const title = String(tokens[index].attrGet('data-title') ?? 'Details');
    const cls = String(tokens[index].attrGet('class') ?? 'md-alert');
    const open = tokens[index].attrGet('data-fold') === '+' ? ' open' : '';
    return `<details class="${escapeHtml(cls)}"${open}><summary>${escapeHtml(title)}</summary>\n`;
  };
  rules.alert_fold_close = () => '</details>\n';

  rules.html_block = (tokens, index) => sanitizeHtml(tokens[index].content, SAFE_HTML);
  rules.html_inline = (tokens, index) => sanitizeInlineTag(tokens[index].content);

  md.core.ruler.after('inline', 'task_lists', state => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length - 2; i++) {
      if (tokens[i].type !== 'list_item_open' || tokens[i + 2].type !== 'inline') continue;
      const inline = tokens[i + 2];
      const match = /^\[([ xX])\] /.exec(inline.content);
      if (!match) continue;
      tokens[i].attrSet('data-checked', String(match[1] !== ' '));
      inline.content = inline.content.slice(4);
      if (inline.children?.[0]?.type === 'text') inline.children[0].content = inline.children[0].content.replace(/^\[([ xX])\] /, '');
    }
  });

  return md;
}
