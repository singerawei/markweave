import {DocumentNavigation} from './navigation';
import {popover} from './popover';
import {shortcutAria, shortcutLabel, type ShortcutId} from './shortcuts';
import {codeNodeView,codeHighlightPlugin,indentCode,newlineCode} from './codeEditing';
import { iconButton,enhance,pdfDialog,setPdfDefaults,configureEnhancements } from './enhancements';
import { setDiagramRenderer } from './diagrams';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { baseKeymap, toggleMark, setBlockType, wrapIn, chainCommands, exitCode, lift } from 'prosemirror-commands';
import { keymap } from 'prosemirror-keymap';
import { splitListItem, liftListItem, sinkListItem, wrapInList } from 'prosemirror-schema-list';
import { inputRules, textblockTypeInputRule, wrappingInputRule } from 'prosemirror-inputrules';
import { tableEditing, goToNextCell,addRowAfter,addColumnAfter,deleteRow,deleteColumn,deleteTable,toggleHeaderRow } from 'prosemirror-tables';
import { parser, schema, serializer, markdownTokenizer } from './schema';
import { preserveEdges } from '../document/serializer';
import { collectAbbreviations, collectReferences, type MarkdownEnv } from '../shared/markdown';
import { tocFromSegments } from '../shared/headings';
import { frontmatterHtml, isFrontmatter } from '../shared/frontmatter';
import type { Segment } from '../shared/types';

declare function acquireVsCodeApi(): {postMessage(message:unknown):void;getState():any;setState(state:unknown):void};
const vscode = acquireVsCodeApi();
const origin = Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-');
const diagramRequests=new Map<string,{resolve:(svg:string)=>void;reject:(error:Error)=>void}>();
if(location.protocol!=='about:')setDiagramRenderer((code,dark,needed,priority)=>new Promise((resolve,reject)=>{const id=crypto.randomUUID();const monitor=setInterval(()=>{if(!needed()){clearInterval(monitor);diagramRequests.delete(id);vscode.postMessage({type:'cancel-diagram',id});reject(new Error('Diagram request superseded.'));}},100);diagramRequests.set(id,{resolve:svg=>{clearInterval(monitor);resolve(svg);},reject:error=>{clearInterval(monitor);reject(error);}});vscode.postMessage({type:'render-diagram',id,code,dark,priority});}));
const root = document.querySelector<HTMLElement>('#document')!;
const status = document.querySelector<HTMLElement>('#status')!;
const notice = document.querySelector<HTMLElement>('#notice')!;
let segments = new Map<string,Segment>();
let ownership = new Map<string,Segment[]>();
const ownerKey = (segment:Segment) => `${segment.sourceUri}::${segment.pieceId}`;
let active: {segment:Segment;view?:EditorView;area?:HTMLTextAreaElement;element:HTMLElement} | undefined;
let readOnly = false; let userReadOnly=false; let documentTitle="";
let historyState={undo:0,redo:0};
let lastDirtyCount:number|undefined;
let longTasks:number[] = [];
try { new PerformanceObserver(list => { longTasks.push(...list.getEntries().map(entry => entry.duration)); }).observe({type:'longtask',buffered:false}); } catch { /* Optional in older Chromium. */ }
const elements = new Map<string,HTMLElement>();
// Theme changes are presentation-only. Re-rendering every mounted segment from
// a body class MutationObserver stalled large documents; diagrams subscribe to
// the theme through their own renderer instead.
const chunkData = new Map<HTMLElement,Segment[]>();
const segmentChunks = new Map<string,HTMLElement>();
let segmentOrder:Segment[]=[];const segmentIndices=new Map<string,number>();
const renderer = markdownTokenizer(true);
let resourceBase = '';
let markdownEnv: MarkdownEnv = {};
const anchorTargets = new Map<string, Segment>();
const headingSlugs = new Map<string, string>();
renderer.renderer.rules.image = (tokens,index) => {
  const token = tokens[index];
  const src = String(token.attrGet('src') ?? '');
  const alt = token.content;
  const title = String(token.attrGet('title') ?? '');
  const titleAttr = title ? ` title="${renderer.utils.escapeHtml(title)}"` : '';
  if (/^https?:\/\//i.test(src)) return `<img loading="lazy" src="${renderer.utils.escapeHtml(src)}" alt="${renderer.utils.escapeHtml(alt)}"${titleAttr}>`;
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|\\\\)/i.test(src) && !src.startsWith('data:image/')) return `<span class="image-placeholder">🖼 ${renderer.utils.escapeHtml(alt || src)}</span>`;
  try { return `<img loading="lazy" src="${renderer.utils.escapeHtml(new URL(src,resourceBase + '/').href)}" alt="${renderer.utils.escapeHtml(alt)}"${titleAttr}>`; }
  catch { return renderer.utils.escapeHtml(alt); }
};
function send(message:unknown) { vscode.postMessage(message); }
window.addEventListener('diagram-rendered',()=>send({type:'metrics',phase:'diagram',timestamp:Date.now()}));
type ToastKind = 'success' | 'info' | 'error';
function dismissToast(item: HTMLElement) {
  item.remove();
  if (!notice.childElementCount) notice.hidden = true;
}
function toast(text: string, kind: ToastKind = 'info', options: {retry?: () => void; details?: string} = {}) {
  if (kind === 'error' && !options.details) options = {...options, details: text};
  const item = document.createElement('div');
  item.className = `toast ${kind}`;
  item.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  const message = document.createElement('span');
  message.className = 'toast-message';
  message.textContent = text;
  item.append(message);
  if (kind === 'error' && options.details) {
    const details = document.createElement('button');
    details.type = 'button';
    details.textContent = 'Details';
    details.onclick = () => information('Error details', options.details!);
    item.append(details);
  }
  if (options.retry) {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Retry';
    retry.onclick = () => { dismissToast(item); options.retry?.(); };
    item.append(retry);
  }
  while (notice.childElementCount >= 4) notice.firstElementChild?.remove();
  notice.hidden = false;
  notice.append(item);
  setTimeout(() => dismissToast(item), kind === 'error' ? 8000 : 3000);
}
function error(text:string, retry?: () => void) { toast(text, 'error', {retry}); }
const requests=new Map<string,{resolve:(result:any)=>void;reject:(error:Error)=>void}>();
function request(type:string,payload:Record<string,unknown>={}){const id=origin+'-'+Math.random().toString(36).slice(2);return new Promise<any>((resolve,reject)=>{requests.set(id,{resolve,reject});send({type,id,...payload});});}
configureEnhancements({canEdit:()=>!readOnly,copy:text=>request('copy',{text}),exportDiagram:(code,dark,format)=>request('export-diagram',{code,dark,format}),notify:(text,kind='info',retry)=>toast(text,kind,{retry})});
function sourceFeedback(){const source=active?.segment;const text=(readOnly?'Read-only':'Editing')+' · '+(source?.sourceFile??documentTitle);status.textContent=text;status.title=source?.sourceUri??documentTitle;}
function setMode(value:boolean){deactivate();userReadOnly=value;readOnly=value;send({type:'mode',readOnly:value});for(const[id,element]of elements)render(element,segments.get(id)!);sourceFeedback();syncToolbar();}

function render(element:HTMLElement,segment:Segment) {
  if (active?.element === element) return;
  element.replaceChildren();
  element.className = 'segment';
  delete element.dataset.large;
  const fenced=/^\s*(?:`{3,}|~{3,})/.test(segment.text);
  const large=segment.text.length>(fenced?128*1024:16*1024)||(/^\s*\|/.test(segment.text)&&segment.text.split('\n').length>200);
  element.dataset.large=String(large);
  if(large){const label=document.createElement('p');label.className='large-block-notice';label.textContent='Large block: inline editing is limited to 128 KiB code, 16 KiB prose or 200 table rows. Use Text Editor for responsive editing. The complete content is preserved.';const preview=document.createElement('pre');preview.textContent=segment.text.slice(0,4000)+'\n…';const open=document.createElement('button');open.textContent='Edit in Text Editor';open.onclick=event=>{event.stopPropagation();send({type:'reveal',uri:segment.sourceUri,pieceId:segment.pieceId});};element.append(label,open,preview);element.dataset.rendered='true';return;}
  if (segment.error) { element.classList.add('include-error'); element.textContent = segment.error; return; }
  if (isFrontmatter(segment.text)) {
    element.classList.add('frontmatter-block','source-backed');
    element.innerHTML = frontmatterHtml(segment.text);
    element.dataset.rendered = 'true';
    return;
  }
  if (!segment.text.trim()) {
    element.innerHTML = '<p class="empty">Start writing…</p>';
    element.dataset.rendered = 'true';
    return;
  }
  resourceBase = (segment as any).resourceBase ?? '';
  try {
    element.innerHTML = renderer.render(segment.text, markdownEnv);
  } catch {
    renderRawPreview(element,segment);
    element.dataset.rendered = 'true';
    return;
  }
  if (!segment.editable) element.classList.add('source-backed');
  for(const item of element.querySelectorAll<HTMLElement>('li[data-checked]')){item.setAttribute('role','checkbox');item.setAttribute('aria-checked',item.dataset.checked!);item.tabIndex=0;}
  enhance(element,segment,text=>update(segment,text));
  applyHeadingAnchors(element,segment);
  const visual = element.querySelector('img,svg,figure,table,pre,.md-toc,.md-comment-block,.frontmatter-card,.math-block,.admonition,.md-alert');
  if (!element.textContent?.trim() && !visual) renderRawPreview(element,segment);
  element.dataset.rendered = 'true';
}
function renderRawPreview(element:HTMLElement,segment:Segment) {
  element.classList.add('source-backed');
  const label = document.createElement('small'); label.textContent = 'Markdown source · Click to edit';
  const raw = document.createElement('pre'); raw.className = 'raw-preview'; raw.textContent = segment.text;
  element.append(label,raw);
}
function applyHeadingAnchors(element:HTMLElement,segment:Segment) {
  const slug = headingSlugs.get(segment.id);
  if (!slug) return;
  element.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6').forEach((heading,index) => {
    heading.id = index === 0 ? slug : `${slug}-${index + 1}`;
  });
  element.dataset.headingSlug = slug;
}
function refreshMarkdownContext() {
  const toc = tocFromSegments(segmentOrder);
  const abbreviations = collectAbbreviations(segmentOrder.map(segment => segment.text));
  markdownEnv = {references: collectReferences(segmentOrder.map(segment => segment.text)), toc, abbreviations};
  const abbrNames = Object.keys(abbreviations);
  const abbrPattern = abbrNames.length ? new RegExp(`\\b(?:${abbrNames.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`) : undefined;
  anchorTargets.clear();
  headingSlugs.clear();
  for (const entry of toc) {
    if (!entry.segmentId) continue;
    const segment = segments.get(entry.segmentId);
    if (!segment) continue;
    anchorTargets.set(entry.slug, segment);
    headingSlugs.set(entry.segmentId, entry.slug);
  }
  for (const [id, element] of elements) {
    const segment = segments.get(id);
    if (!segment || active?.element === element) continue;
    applyHeadingAnchors(element, segment);
    if (/\]\[|^\s*\[toc\]\s*$|^\*\[[^\]]+\]:/im.test(segment.text) || abbrPattern?.test(segment.text)) render(element, segment);
  }
}
function mountChunk(chunk:HTMLElement) {
  if (chunk.dataset.mounted) return;
  chunk.dataset.mounted = 'true'; chunk.style.minHeight = '';
  for (const segment of chunkData.get(chunk) ?? []) {
    chunk.append(makeSegment(segment));
  }
}
function makeSegment(segment:Segment){const element=document.createElement('section');element.className='segment';element.dataset.id=segment.id;element.title=segment.sourceUri;element.tabIndex=0;element.dataset.vscodeContext=JSON.stringify({webviewSection:'markdownup',sourceUri:segment.sourceUri,pieceId:segment.pieceId});elements.set(segment.id,element);render(element,segment);return element;}
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    const chunk = entry.target as HTMLElement;
    if (entry.isIntersecting) mountChunk(chunk);
    else if (chunk.dataset.mounted && !chunk.contains(active?.element ?? null)) {
      chunk.style.minHeight = `${chunk.getBoundingClientRect().height}px`;
      for (const segment of chunkData.get(chunk) ?? []) elements.delete(segment.id);
      chunk.replaceChildren(); delete chunk.dataset.mounted;
    }
  }
},{rootMargin:'1000px'});

function update(segment:Segment,text:string) {
  if(readOnly)return;
  if (text === segment.text) return;
  const before = segment.text;
  for (const current of ownership.get(ownerKey(segment)) ?? []) {
    current.text = text;navigator.index(current);
    const element = elements.get(current.id)!;
    if (element && element !== active?.element) render(element,current);
  }
  if (needsContextRefresh(before, text)) contextPending = true;
  send({type:'edit',uri:segment.sourceUri,pieceId:segment.pieceId,before,text,origin});
}
let contextPending = false;
function needsContextRefresh(...values: string[]) {
  return values.some(value => /^ {0,3}#{1,6}\s|^ {0,3}\[[^\]]+\]:|^ {0,3}\*\[[^\]]+\]:|^ {0,3}\[toc\]\s*$|^[^\r\n]+\r?\n {0,3}(?:=+|-+)\s*$/im.test(value));
}
function deactivate() {
  if (!active) return;
  const previous = active;
  active.view?.destroy(); active = undefined;
  previous.element.classList.remove('editing');
  render(previous.element,previous.segment);
  syncToolbar();
  if (contextPending) {
    contextPending = false;
    refreshMarkdownContext();
  }
}
function activate(element:HTMLElement,segment:Segment,raw = false) {
  if (readOnly || element.dataset.large==='true') return;
  if (segment.error || active?.element === element) return;
  deactivate(); element.replaceChildren(); element.classList.add('editing');
  active = {segment,element}; sourceFeedback();
  if (!segment.editable || raw) {
    const area = document.createElement('textarea'); area.className = 'raw-editor'; area.value = segment.text;
    area.setAttribute('aria-label','Raw Markdown block');
    area.rows = Math.max(3,Math.min(25,segment.text.split('\n').length));
    area.addEventListener('input',() => update(segment,area.value));
    element.append(area); active.area = area; area.focus(); syncToolbar(); return;
  }
  try {
    const state = EditorState.create({schema,doc:parser.parse(segment.text),plugins:[
      inputRules({rules:[textblockTypeInputRule(/^(#{1,6})\s$/,schema.nodes.heading,match => ({level:match[1].length})),
        wrappingInputRule(/^\s*>\s$/,schema.nodes.blockquote),wrappingInputRule(/^\s*([-+*])\s$/,schema.nodes.bullet_list),
        wrappingInputRule(/^(\d+)\.\s$/,schema.nodes.ordered_list,match => ({order:+match[1]}))]}),
      codeHighlightPlugin(),
      keymap({'Mod-b':toggleMark(schema.marks.strong),'Mod-i':toggleMark(schema.marks.em),'Mod-`':toggleMark(schema.marks.code),
        'Mod-Home':(state,dispatch)=>{dispatch?.(state.tr.setSelection(TextSelection.atStart(state.doc)));return true;},'Mod-End':(state,dispatch)=>{dispatch?.(state.tr.setSelection(TextSelection.atEnd(state.doc)));return true;},
        Enter:chainCommands(newlineCode,splitListItem(schema.nodes.list_item)),'Mod-Enter':exitCode,
        Tab:chainCommands(indentCode(),goToNextCell(1),sinkListItem(schema.nodes.list_item)),
        'Shift-Tab':chainCommands(indentCode(true),goToNextCell(-1),liftListItem(schema.nodes.list_item))}),
      keymap(baseKeymap),tableEditing()
    ]});
    const view = new EditorView(element,{state,
      handleKeyDown(view,event){
        if(readOnly||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||!view.state.selection.empty)return false;
        const atStart=view.state.selection.from===TextSelection.atStart(view.state.doc).from,atEnd=view.state.selection.from===TextSelection.atEnd(view.state.doc).from;
        const direction=(atStart&&['ArrowUp','ArrowLeft','Backspace'].includes(event.key))?-1:(atEnd&&['ArrowDown','ArrowRight','Delete'].includes(event.key))?1:0;if(!direction)return false;
        const neighbor=segmentOrder[(segmentIndices.get(segment.id)??0)+direction];if(!neighbor)return false;
        if(['Backspace','Delete'].includes(event.key)){
          if(segment.sourceUri!==neighbor.sourceUri||segment.includeInstanceId!==neighbor.includeInstanceId||segment.blockType!=='paragraph_open'||neighbor.blockType!=='paragraph_open'){error('Source boundary protected. Use the source editors to restructure across files.');return true;}
          const first=direction<0?neighbor:segment,second=direction<0?segment:neighbor;const merged=first.text.trimEnd()+second.text.trimStart();joinRestoration={uri:first.sourceUri,pieceId:first.pieceId,id:first.id,text:merged,top:element.getBoundingClientRect().top,position:parser.parse(first.text).content.size-1,focus:true};void request('join-blocks',{uri:segment.sourceUri,first:first.pieceId,second:second.pieceId}).catch(reason=>{joinRestoration=undefined;error(String(reason));});return true;
        }
        mountChunk(segmentChunks.get(neighbor.id)!);const target=elements.get(neighbor.id)!;activate(target,neighbor);if(active?.view){active.view.dispatch(active.view.state.tr.setSelection(direction>0?TextSelection.atStart(active.view.state.doc):TextSelection.atEnd(active.view.state.doc)).scrollIntoView());}return true;
      },
      dispatchTransaction(transaction) {
        if(transaction.docChanged && readOnly)return;
        view.updateState(view.state.apply(transaction));
        syncToolbar();
        if (transaction.docChanged) update(segment,preserveEdges(segment.text,serializer.serialize(view.state.doc)));
      },
      nodeViews:{code_block:(node,view,getPos)=>codeNodeView(node,view,getPos),image(node) {
        const image = document.createElement('img'); const src = String(node.attrs.src);
        image.alt = node.attrs.alt ?? '';
        if (!/^(?:[a-z][a-z\d+.-]*:|\/\/|\\\\)/i.test(src)) image.src = new URL(src,((segment as any).resourceBase ?? '') + '/').href;
        return {dom:image};
      }},
      handleClick(view,pos,event) {
        const target = (event.target as HTMLElement).closest('li[data-checked]');
        if (!target || event.clientX > target.getBoundingClientRect().left + 2) return false;
        const resolved = view.state.doc.resolve(pos);
        for (let depth = resolved.depth; depth > 0; depth--) if (resolved.node(depth).type === schema.nodes.list_item) {
          const node = resolved.node(depth);
          view.dispatch(view.state.tr.setNodeMarkup(resolved.before(depth),undefined,{...node.attrs,checked:!node.attrs.checked})); return true;
        }
        return false;
      }
    });
    active.view = view; view.focus();syncToolbar();
  } catch (reason) {
    active = undefined; error(`This block is protected as raw Markdown: ${String(reason)}`);
    activate(element,segment,true);
  }
}
function scrollElementToToolbar(element: HTMLElement) {
  const align = () => {
    const delta = element.getBoundingClientRect().top - toolbarBottom();
    if (Math.abs(delta) > 1) window.scrollBy(0, delta);
  };
  align();
  requestAnimationFrame(() => { align(); requestAnimationFrame(align); });
  setTimeout(align, 120);
}
function scrollToHash(hash: string) {
  let id = hash.replace(/^#/, '');
  try { id = decodeURIComponent(id); } catch { /* Keep the raw fragment. */ }
  const heading = anchorTargets.get(id);
  if (heading) { jump(heading, undefined, true); return; }
  const target = document.getElementById(id);
  if (target) { scrollElementToToolbar(target); return; }
  const footnote = /^fn-(.+)$/.exec(id);
  if (footnote) {
    const label = footnote[1];
    const segment = segmentOrder.find(item => item.text.includes(`[^${label}]:`) || item.text.includes(`[^${label}]`));
    if (segment) jump(segment, undefined, true);
  }
}
root.addEventListener('click',event => {
  const target = event.target as HTMLElement;
  const wikilink = target.closest<HTMLElement>('[data-wikilink]');
  if (wikilink) {
    event.preventDefault();
    const element = wikilink.closest<HTMLElement>('.segment');
    const source = element ? segments.get(element.dataset.id!) : undefined;
    if (source) send({type:'wikilink',target:wikilink.dataset.wikilink,uri:source.sourceUri});
    return;
  }
  const toc = target.closest<HTMLElement>('[data-toc-segment]');
  if (toc) {
    event.preventDefault();
    const segment = segments.get(toc.dataset.tocSegment!);
    if (segment) jump(segment, undefined, true);
    return;
  }
  const link = target.closest('a');
  if (link) {
    event.preventDefault();
    const href = link.getAttribute('href') ?? '';
    if (href.startsWith('#')) { scrollToHash(href); return; }
    const element = link.closest<HTMLElement>('.segment');
    if (element) send({type:'link',href,uri:segments.get(element.dataset.id!)!.sourceUri});
    return;
  }
  const element = target.closest<HTMLElement>('.segment');
  if (element) {
    const isNew = active?.element !== element;
    const task = target.closest<HTMLElement>('li[data-checked]');
    const taskIndex = task && event.clientX < task.getBoundingClientRect().left + 2 ? [...element.querySelectorAll('li[data-checked]')].indexOf(task) : -1;
    activate(element,segments.get(element.dataset.id!)!);
    if (isNew && active?.view) {
      if (taskIndex >= 0) {
        const view = active.view; let index = 0;
        view.state.doc.descendants((node,pos) => {
          if (node.type === schema.nodes.list_item && node.attrs.checked !== null && index++ === taskIndex) view.dispatch(view.state.tr.setNodeMarkup(pos,undefined,{...node.attrs,checked:!node.attrs.checked}));
        });
        return;
      }
      const position = active.view.posAtCoords({left:event.clientX,top:event.clientY});
      if (position) active.view.dispatch(active.view.state.tr.setSelection(TextSelection.near(active.view.state.doc.resolve(position.pos))));
    }
  }
});
root.dataset.vscodeContext=JSON.stringify({webviewSection:'markdownup'});
root.addEventListener('keydown',event=>{const task=(event.target as HTMLElement).closest<HTMLElement>('li[role=checkbox]');if(!task||![' ','Enter'].includes(event.key)||readOnly)return;event.preventDefault();event.stopPropagation();const element=task.closest<HTMLElement>('.segment')!;const index=[...element.querySelectorAll('li[data-checked]')].indexOf(task);activate(element,segments.get(element.dataset.id!)!);const view=active?.view;if(view){let current=0;view.state.doc.descendants((node,pos)=>{if(node.type===schema.nodes.list_item&&node.attrs.checked!==null&&current++===index)view.dispatch(view.state.tr.setNodeMarkup(pos,undefined,{...node.attrs,checked:!node.attrs.checked}));});}},true);
root.addEventListener('keydown',event => {
  if (event.key === 'Enter' && event.target instanceof HTMLElement && event.target.classList.contains('segment')) activate(event.target,segments.get(event.target.dataset.id!)!);
});
document.addEventListener('keydown',event=>{
  if(!(event.ctrlKey||event.metaKey)||event.altKey)return;
  const key=event.key.toLowerCase();const target=event.target as HTMLElement;const local=!!target.closest('input,textarea,select,dialog');
  if(key==='s'){event.preventDefault();event.stopPropagation();if(!document.querySelector('dialog[open]'))send({type:event.shiftKey?'save-as':'save'});return;}
  if(['z','y'].includes(key)){if(local){event.stopPropagation();return;}event.preventDefault();event.stopPropagation();if(!readOnly)send({type:key==='y'||event.shiftKey?'redo':'undo'});}
},true);
document.querySelector('header')?.remove(); document.querySelector('footer')?.remove();
const toolbar = document.querySelector<HTMLElement>('#toolbar')!;
toolbar.setAttribute('aria-label','Document toolbar');
toolbar.replaceChildren();
let toolbarHidden = false;
let focusMode = false;
const toolbarButtons = new Map<string, HTMLButtonElement>();

function toolbarBottom() {
  const rect = toolbar.getBoundingClientRect();
  return rect.height > 0 && getComputedStyle(toolbar).display !== 'none' ? rect.bottom : 0;
}
function editorTarget(): HTMLElement | undefined {
  if (active?.view?.dom.isConnected) return active.view.dom;
  if (active?.area?.isConnected) return active.area;
  if (active?.element.isConnected) return active.element;
  return undefined;
}
function focusEditor() { editorTarget()?.focus({preventScroll: true}); }

const style = document.createElement('select');
style.className = 'block-style';
style.setAttribute('aria-label', 'Paragraph style');
for (const [value, label] of [['paragraph', 'Paragraph'], ['1', 'Heading 1'], ['2', 'Heading 2'], ['3', 'Heading 3'], ['quote', 'Quote'], ['bullet', 'Bullet list'], ['ordered', 'Ordered list']]) {
  const option = document.createElement('option'); option.value = value; option.textContent = label; style.append(option);
}
toolbar.append(style);

function toolbarButton(label: string, run: () => void, shortcut?: ShortcutId, shortcutText?: string) {
  const element = iconButton(label, run);
  toolbar.append(element);
  const hint = shortcutText ?? (shortcut ? shortcutLabel(shortcut) : '');
  element.title = hint ? `${label} (${hint})` : label;
  if (shortcut) element.setAttribute('aria-keyshortcuts', shortcutAria(shortcut));
  toolbarButtons.set(label, element);
  return element;
}
function command(run: any) {
  if (readOnly || !active?.view) return false;
  run(active.view.state, active.view.dispatch, active.view);
  active.view.focus();
  syncToolbar();
  return true;
}
function toggleContainer(type: typeof schema.nodes.bullet_list) {
  const view = active?.view; if (!view || readOnly) return;
  const inside = Array.from({length: view.state.selection.$from.depth}, (_, i) => view.state.selection.$from.node(i + 1)).some(node => node.type === type);
  command(inside ? (type === schema.nodes.blockquote ? lift : liftListItem(schema.nodes.list_item)) : (type === schema.nodes.blockquote ? wrapIn(type) : wrapInList(type)));
}
function currentBlockStyle(view: EditorView | undefined) {
  if (!view) return 'paragraph';
  const selection = view.state.selection;
  for (let depth = selection.$from.depth; depth > 0; depth--) {
    const node = selection.$from.node(depth);
    if (node.type === schema.nodes.heading) return String(Math.min(3, node.attrs.level));
    if (node.type === schema.nodes.blockquote) return 'quote';
    if (node.type === schema.nodes.bullet_list) return 'bullet';
    if (node.type === schema.nodes.ordered_list) return 'ordered';
  }
  return 'paragraph';
}
style.onchange = () => {
  const value = style.value;
  if (value === 'paragraph') command(setBlockType(schema.nodes.paragraph));
  else if (/^[123]$/.test(value)) command(setBlockType(schema.nodes.heading, {level: Number(value)}));
  else if (value === 'quote') toggleContainer(schema.nodes.blockquote);
  else if (value === 'bullet') toggleContainer(schema.nodes.bullet_list);
  else if (value === 'ordered') toggleContainer(schema.nodes.ordered_list);
  syncToolbar();
};

function syncToolbar() {
  const view = readOnly ? undefined : active?.view;
  style.disabled = !view;
  style.title = view ? 'Paragraph style' : 'Paragraph style — click a text block first';
  if (view) style.value = currentBlockStyle(view);
  const marks = view ? (view.state.storedMarks ?? view.state.selection.$from.marks()) : [];
  const setMark = (label: string, markName: string) => {
    const element = toolbarButtons.get(label); if (!element) return;
    element.disabled = !view;
    element.setAttribute('aria-pressed', String(marks.some(mark => mark.type.name === markName)));
    element.title = `${label} (${shortcutLabel(label === 'Bold' ? 'bold' : 'italic')})${view ? '' : ' — click a text block first'}`;
  };
  setMark('Bold', 'strong');
  setMark('Italic', 'em');
  for (const [label, shortcut] of [['Undo', 'undo'], ['Redo', 'redo']] as const) {
    const element = toolbarButtons.get(label); if (!element) continue;
    const empty = label === 'Undo' ? historyState.undo === 0 : historyState.redo === 0;
    element.disabled = readOnly || empty;
    element.title = `${label} (${shortcutLabel(shortcut)})${empty ? ' — no history' : ''}`;
  }
  const insert = toolbarButtons.get('Insert');
  if (insert) {
    insert.disabled = !view;
    insert.title = `Insert (${shortcutLabel('insert')})${view ? '' : ' — click a text block first'}`;
  }
}
document.addEventListener('selectionchange', syncToolbar);
toolbarButton('Bold', () => command(toggleMark(schema.marks.strong)), 'bold');
toolbarButton('Italic', () => command(toggleMark(schema.marks.em)), 'italic');
toolbarButton('Undo', () => send({type: 'undo'}), 'undo');
toolbarButton('Redo', () => send({type: 'redo'}), 'redo');

async function ask(title:string,fields:{name:string;label:string;value?:string}[]) {
  const dialog = document.createElement('dialog'); const form = document.createElement('form'); form.method = 'dialog';
  const heading = document.createElement('h3'); heading.textContent = title; form.append(heading);
  for (const field of fields) {
    const label = document.createElement('label'); label.textContent = field.label;
    const input = document.createElement('input'); input.name = field.name; input.value = field.value ?? ''; input.required = true; label.append(input); form.append(label);
  }
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel'; cancel.onclick = () => dialog.close('cancel');
  const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = 'Insert'; form.append(cancel,submit); dialog.append(form); document.body.append(dialog);
  form.onsubmit = () => dialog.returnValue = 'insert';
  return new Promise<Record<string,string> | undefined>(resolve => {
    dialog.addEventListener('close',() => { const values = Object.fromEntries(new FormData(form).entries()) as Record<string,string>; const accepted = dialog.returnValue === 'insert'; dialog.remove(); resolve(accepted ? values : undefined); });
    dialog.showModal();
  });
}
interface InsertEntry {
  button: HTMLButtonElement;
  context?: 'table' | 'list';
  check?: (state: any) => boolean;
}
const insertMenu = document.createElement('div');
insertMenu.className = 'insert-menu';
insertMenu.hidden = true;
document.body.append(insertMenu);
const insertEntries: InsertEntry[] = [];
function addInsert(label: string, run: () => void, options: {context?: 'table' | 'list'; check?: (state: any) => boolean} = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.onclick = run;
  insertMenu.append(button);
  insertEntries.push({button, ...options});
  return button;
}
function insertBlock(factory: (view: EditorView) => unknown) {
  const view = active?.view;
  if (!view || readOnly) return;
  factory(view);
  view.focus();
  syncToolbar();
}
addInsert('Ordered list', () => command(wrapInList(schema.nodes.ordered_list)));
addInsert('Task list', () => insertBlock(view => {
  const paragraph = schema.nodes.paragraph.create(null, schema.text('Task'));
  view.dispatch(view.state.tr.replaceSelectionWith(schema.nodes.bullet_list.create(null, schema.nodes.list_item.create({checked: false}, paragraph))).scrollIntoView());
}));
addInsert('Code block', () => command(setBlockType(schema.nodes.code_block)));
addInsert('Mermaid diagram', () => {
  const view = active?.view; const element = active?.element;
  if (!view || readOnly) return;
  view.dispatch(view.state.tr.replaceSelectionWith(schema.nodes.code_block.create({params: 'mermaid'}, schema.text('flowchart LR\n  A[Start] --> B[End]'))));
  deactivate(); element?.focus({preventScroll: true});
});
addInsert('Table', () => insertBlock(view => {
  const node = schema.nodes.table.create(null, [
    schema.nodes.table_row.create(null, [schema.nodes.table_header.create(null, schema.text('Heading')), schema.nodes.table_header.create(null, schema.text('Description'))]),
    schema.nodes.table_row.create(null, [schema.nodes.table_cell.create(null, schema.text('Content')), schema.nodes.table_cell.create(null, schema.text('Content'))])
  ]);
  view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView());
}));
async function insertLinkOrImage(choice: 'link' | 'image') {
  const view = active?.view; if (!view || readOnly) return;
  let path = '';
  if (choice === 'image') {
    try { path = await request('pick-image', {uri: active!.segment.sourceUri}) ?? ''; }
    catch (reason) { error(String(reason)); return; }
  }
  const values = await ask(choice === 'link' ? 'Insert link' : 'Insert image', [
    {name: 'text', label: choice === 'link' ? 'Link text' : 'Alt text', value: view.state.doc.textBetween(view.state.selection.from, view.state.selection.to) || (path ? path.split('/').pop() : '')},
    {name: 'url', label: 'URL / relative path', value: path}
  ]);
  if (!values || readOnly) return;
  if (/^(?:javascript|vbscript|data):/i.test(values.url.trim())) { error('Enter a safe link or local image path.'); return; }
  const node = choice === 'image' ? schema.nodes.image.create({src: values.url, alt: values.text}) : schema.text(values.text, [schema.marks.link.create({href: values.url})]);
  view.dispatch(view.state.tr.replaceSelectionWith(node, false)); view.focus();
}
addInsert('Link', () => { void insertLinkOrImage('link'); });
addInsert('Image', () => { void insertLinkOrImage('image'); });
addInsert('Horizontal rule', () => insertBlock(view => view.dispatch(view.state.tr.replaceSelectionWith(schema.nodes.horizontal_rule.create()).scrollIntoView())));
addInsert('Inline code', () => command(toggleMark(schema.marks.code)));
addInsert('Strikethrough', () => command(toggleMark(schema.marks.strike)));
for (const [label, text] of [['Insert paragraph before', 'before'], ['Insert paragraph after', 'after']] as const) {
  addInsert(label, () => insertBlock(view => {
    const position = text === 'before' ? 0 : view.state.doc.content.size;
    view.dispatch(view.state.tr.insert(position, schema.nodes.paragraph.create()));
  }));
}
const contextual: [string, any, 'table' | 'list'][] = [
  ['Indent', sinkListItem(schema.nodes.list_item), 'list'],
  ['Outdent', liftListItem(schema.nodes.list_item), 'list'],
  ['Add table row', addRowAfter, 'table'],
  ['Add table column', addColumnAfter, 'table'],
  ['Delete table row', deleteRow, 'table'],
  ['Delete table column', deleteColumn, 'table'],
  ['Toggle table header', toggleHeaderRow, 'table'],
  ['Delete table', deleteTable, 'table'],
];
for (const [label, action, context] of contextual) addInsert(label, () => command(action), {context, check: action});

function configureInsert() {
  const view = readOnly ? undefined : active?.view;
  const ancestors = view ? Array.from({length: view.state.selection.$from.depth}, (_, i) => view.state.selection.$from.node(i + 1).type.name) : [];
  for (const entry of insertEntries) {
    const inContext = entry.context === 'table' ? ancestors.some(name => name.startsWith('table'))
      : entry.context === 'list' ? ancestors.includes('list_item') : true;
    entry.button.hidden = !inContext;
    entry.button.disabled = !view || (!!entry.check && !safeCheck(entry.check, view.state));
  }
}
function safeCheck(check: (state: any) => boolean, state: any) {
  try { return check(state); } catch { return false; }
}

const insertButton = iconButton('Insert', () => {});
toolbar.append(insertButton);
toolbarButtons.set('Insert', insertButton);
insertButton.setAttribute('aria-keyshortcuts', shortcutAria('insert'));
insertButton.title = `Insert (${shortcutLabel('insert')})`;
popover(insertButton, insertMenu, {
  onOpen: configureInsert,
  restoreFocus: editorTarget,
  onClose: reason => { if (reason === 'escape') focusEditor(); },
});

function jump(segment: Segment, query?: string, alignTop = true) {
  const chunk = segmentChunks.get(segment.id);
  if (!chunk) return;
  mountChunk(chunk);
  const element = elements.get(segment.id);
  if (!element) return;
  const align = () => {
    const target = element.querySelector<HTMLElement>('h1,h2,h3,h4,h5,h6') ?? element;
    if (alignTop) {
      const delta = target.getBoundingClientRect().top - toolbarBottom();
      if (Math.abs(delta) > 1) window.scrollBy(0, delta);
    } else target.scrollIntoView({block: 'center'});
  };
  align();
  requestAnimationFrame(() => { align(); requestAnimationFrame(align); });
  // Content-visibility and lazy chunk mounting can settle after the first two
  // frames. Re-align once the layout is stable.
  setTimeout(align, 80);
  setTimeout(align, 160);
  element.focus({preventScroll: true});
  root.querySelector('.search-hit')?.classList.remove('search-hit');
  element.classList.add('search-hit');
  if (query) element.setAttribute('aria-label', 'Search match: ' + query);
}

const navigator = new DocumentNavigation({
  jump,
  getEditorTarget: editorTarget,
  getToolbarBottom: toolbarBottom,
  getDocumentRoot: () => root,
  isTrigger: target => target instanceof Element && !!target.closest('[data-navigation-trigger]'),
  onPreferenceChange: patch => {
    if (typeof patch.pinned === 'boolean') send({type: 'preference', key: 'navigationPinned', value: patch.pinned});
    if (patch.mode) send({type: 'preference', key: 'navigationMode', value: patch.mode});
  },
  onVisibilityChange: open => navigateButton.setAttribute('aria-expanded', String(open)),
});
const navigateButton = toolbarButton('Navigate', () => navigator.toggle(navigator.currentMode, navigateButton), undefined, `${shortcutLabel('find')} / ${shortcutLabel('outline')}`);
navigateButton.setAttribute('data-navigation-trigger', 'true');
navigateButton.setAttribute('aria-keyshortcuts', `${shortcutAria('find')} ${shortcutAria('outline')}`);
navigateButton.setAttribute('aria-expanded', 'false');

function find() { navigator.toggle('find', navigateButton); }
function outline() { navigator.toggle('outline', navigateButton); }
function navigateWithLastMode() { navigator.toggle(navigator.currentMode, navigateButton); }
function toggleInsertMenu() {
  if (insertButton.disabled) { toast('Choose a text block before inserting content.', 'info'); return; }
  insertButton.click();
}
document.addEventListener('keydown', event => {
  if (event.defaultPrevented || document.querySelector('dialog[open]')) return;
  const target = event.target as HTMLElement;
  const mod = event.ctrlKey || event.metaKey;
  if (mod && !event.altKey && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    find();
    return;
  }
  if (mod && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'o') {
    event.preventDefault();
    outline();
    return;
  }
  if (mod && event.altKey && !event.shiftKey) {
    const key = event.key.toLowerCase();
    if (key === 'p') { event.preventDefault(); togglePinnedNavigation(); return; }
    if (key === 't') { event.preventDefault(); toggleToolbarVisibility(); return; }
    if (key === 'i') { event.preventDefault(); toggleInsertMenu(); return; }
    if (key === 'f') { event.preventDefault(); toggleFocusMode(); return; }
    if (key === 'o') { event.preventDefault(); outline(); return; }
    if (key === 'h') { event.preventDefault(); showHelp(); return; }
    if (key === 'e') { event.preventDefault(); pdfDialog(send); return; }
  }
  if (event.key === '?' && !mod && !event.altKey && !target.closest('input,textarea,select,[contenteditable="true"]')) {
    event.preventDefault();
    showHelp();
  }
});
const more = document.createElement('div');
more.className = 'insert-menu more-menu';
more.hidden = true;
document.body.append(more);
const moreButton = iconButton('More', () => {});
toolbar.append(moreButton);
toolbarButtons.set('More', moreButton);
moreButton.title = 'More actions';
const moreItems = new Map<string, HTMLButtonElement>();
function moreItem(label: string, run: () => void, options: {key?: string; shortcut?: ShortcutId; editable?: boolean} = {}) {
  const item = document.createElement('button');
  item.type = 'button';
  item.textContent = label;
  item.onclick = run;
  if (options.shortcut) {
    item.title = `${label} (${shortcutLabel(options.shortcut)})`;
    item.setAttribute('aria-keyshortcuts', shortcutAria(options.shortcut));
  }
  if (options.editable) item.dataset.editable = 'true';
  more.append(item);
  if (options.key) moreItems.set(options.key, item);
  return item;
}
moreItem('Export PDF', () => pdfDialog(send), {shortcut: 'exportPdf'});
moreItem('Manage includes', () => { void manageIncludes(); });
const readingWidthItem = moreItem('Reading width', () => {
  const wide = root.classList.toggle('wide-reading');
  readingWidthItem.setAttribute('aria-pressed', String(wide));
});
readingWidthItem.setAttribute('aria-pressed', 'false');
const focusItem = moreItem('Focus mode', () => toggleFocusMode(), {key: 'focusMode', shortcut: 'focusMode'});
moreItem('Text size', () => textSizeDialog());
const readOnlyItem = moreItem('Read-only preview', () => setMode(!userReadOnly), {key: 'readOnly'});
moreItem('Reveal source', () => {
  if (active) send({type: 'reveal', uri: active.segment.sourceUri, pieceId: active.segment.pieceId});
}, {key: 'reveal', editable: true});
moreItem('Help', () => showHelp(), {shortcut: 'help'});
moreItem('About', () => information('MarkdownUP', '0.3.0 · Local-first Markdown with editable includes.'));
moreItem('Hide toolbar', () => setToolbarHidden(true), {shortcut: 'toggleToolbar'});
popover(moreButton, more, {
  onOpen: () => {
    focusItem.textContent = focusMode ? 'Exit focus mode' : 'Focus mode';
    focusItem.title = `${focusItem.textContent} (${shortcutLabel('focusMode')})`;
    readOnlyItem.textContent = userReadOnly ? 'Enable editing' : 'Read-only preview';
    const reveal = moreItems.get('reveal');
    if (reveal) {
      reveal.disabled = !active;
      reveal.title = active ? 'Reveal the active block in its source file' : 'Click a text block first';
    }
  },
});
async function manageIncludes(){
  const dialog=document.createElement('dialog');const title=document.createElement('h2');title.textContent='Manage includes';const source=document.createElement('select');source.setAttribute('aria-label','Include source file');const rows=document.createElement('div');const path=document.createElement('input');path.placeholder='./chapter.md';path.setAttribute('aria-label','Include path');const add=document.createElement('button');add.textContent='Add include';const close=document.createElement('button');close.textContent='Close';close.onclick=()=>dialog.close();
  let sources:any[]=[];const refresh=async()=>{sources=await request('includes');const selected=source.value;source.replaceChildren();for(const item of sources){const option=document.createElement('option');option.value=item.uri;option.textContent=item.uri.split('/').pop();source.append(option);}source.value=sources.some(item=>item.uri===selected)?selected:(active?.segment.sourceUri??source.options[0]?.value);paint();};
  const paint=()=>{rows.replaceChildren();for(const item of sources.find(item=>item.uri===source.value)?.imports??[]){const row=document.createElement('div');row.textContent=item.path;const remove=document.createElement('button');remove.textContent='Remove include';remove.disabled=readOnly;remove.onclick=()=>{if(!readOnly)void request('include-edit',{action:'remove',uri:source.value,pieceId:item.id}).then(refresh,reason=>error(String(reason)));};row.append(remove);rows.append(row);}add.disabled=readOnly;};source.onchange=paint;
  add.onclick=()=>{if(!readOnly)void request('include-edit',{action:'add',uri:source.value,path:path.value}).then(()=>{path.value='';void refresh();},reason=>error(String(reason)));};dialog.addEventListener('close',()=>dialog.remove());dialog.append(title,source,rows,path,add,close);document.body.append(dialog);dialog.showModal();try{await refresh();}catch(reason){error(String(reason));dialog.close();}
}
const showToolbarButton = document.createElement('button');
showToolbarButton.type = 'button';
showToolbarButton.className = 'floating-chrome show-toolbar';
showToolbarButton.textContent = 'Show toolbar';
showToolbarButton.hidden = true;
showToolbarButton.setAttribute('aria-keyshortcuts', shortcutAria('toggleToolbar'));
showToolbarButton.title = `Show toolbar (${shortcutLabel('toggleToolbar')})`;
showToolbarButton.onclick = () => setToolbarHidden(false);
document.body.append(showToolbarButton);

const focusExitButton = document.createElement('button');
focusExitButton.type = 'button';
focusExitButton.className = 'floating-chrome exit-focus';
focusExitButton.textContent = 'Exit focus mode';
focusExitButton.hidden = true;
focusExitButton.setAttribute('aria-keyshortcuts', shortcutAria('focusMode'));
focusExitButton.title = `Exit focus mode (${shortcutLabel('focusMode')})`;
focusExitButton.onclick = () => toggleFocusMode();
document.body.append(focusExitButton);

function updateChrome() {
  showToolbarButton.hidden = !toolbarHidden || focusMode;
  focusExitButton.hidden = !focusMode;
}
function applyChromeClass(name: string, enabled: boolean) {
  const before = toolbar.offsetHeight;
  document.body.classList.toggle(name, enabled);
  const after = toolbar.offsetHeight;
  // Removing the in-flow toolbar must not move the reader's text.
  if (before !== after && window.scrollY > 0) window.scrollBy(0, after - before);
}
function setToolbarHidden(hidden: boolean, persist = true) {
  toolbarHidden = hidden;
  applyChromeClass('toolbar-hidden', hidden);
  if (hidden) focusEditor();
  else {
    const focused = document.activeElement as HTMLElement | null;
    if (!focused || focused === showToolbarButton || focused === document.body) focusEditor();
  }
  updateChrome();
  if (persist) send({type: 'preference', key: 'toolbarHidden', value: hidden});
}
function toggleToolbarVisibility() { setToolbarHidden(!toolbarHidden); }
function setFocusMode(value: boolean) {
  focusMode = value;
  applyChromeClass('focus-mode', value);
  if (value) {
    const focused = document.activeElement as HTMLElement | null;
    if (focused && (toolbar.contains(focused) || navigator.element.contains(focused))) focusEditor();
  } else {
    const focused = document.activeElement as HTMLElement | null;
    if (!focused || focused === focusExitButton || focused === showToolbarButton || focused === document.body) focusEditor();
  }
  updateChrome();
}
function toggleFocusMode() { setFocusMode(!focusMode); }
function togglePinnedNavigation() {
  if (navigator.element.hidden) navigator.open(navigator.currentMode, navigateButton);
  navigator.togglePinned();
}
function textSizeDialog() {
  const dialog = document.createElement('dialog');
  const heading = document.createElement('h2');
  heading.textContent = 'Text size';
  const output = document.createElement('output');
  const close = document.createElement('button');
  close.type = 'button'; close.textContent = 'Close'; close.onclick = () => dialog.close();
  const apply = (size: number) => {
    const next = Math.max(12, Math.min(28, size));
    root.style.fontSize = `${next}px`;
    output.textContent = `${next}px`;
  };
  const row = document.createElement('div');
  row.className = 'dialog-row';
  const smaller = document.createElement('button'); smaller.textContent = 'Smaller'; smaller.onclick = () => apply((parseFloat(getComputedStyle(root).fontSize) || 16) - 1);
  const reset = document.createElement('button'); reset.textContent = 'Reset'; reset.onclick = () => apply(16);
  const larger = document.createElement('button'); larger.textContent = 'Larger'; larger.onclick = () => apply((parseFloat(getComputedStyle(root).fontSize) || 16) + 1);
  row.append(smaller, output, larger, reset);
  dialog.append(heading, row, close);
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  output.textContent = `${parseFloat(getComputedStyle(root).fontSize) || 16}px`;
  dialog.showModal();
}
function showHelp() {
  const lines = [
    `Save: ${shortcutLabel('save')}`,
    `Save As: ${shortcutLabel('saveAs')}`,
    `Find: ${shortcutLabel('find')} · Outline: ${shortcutLabel('outline')}`,
    `Insert: ${shortcutLabel('insert')} · Pin navigation: ${shortcutLabel('pinNavigation')}`,
    `Toggle toolbar: ${shortcutLabel('toggleToolbar')} · Focus mode: ${shortcutLabel('focusMode')}`,
    `Bold: ${shortcutLabel('bold')} · Italic: ${shortcutLabel('italic')}`,
    `Undo: ${shortcutLabel('undo')} · Redo: ${shortcutLabel('redo')}`,
    `Export PDF: ${shortcutLabel('exportPdf')}`,
    '',
    'Help is also available from the Command Palette (MarkdownUP: Help) and the ? key when you are not typing in the document.',
    'Esc closes navigation when it is not pinned. Fixed navigation stays open until you close it or unpin it.',
    'Text fields keep their native undo history. Large blocks open in the native Text Editor.',
  ];
  information('Keyboard shortcuts', lines.join('\n'));
}
function information(title: string, text: string) {
  const dialog = document.createElement('dialog');
  const h = document.createElement('h2'); h.textContent = title;
  const p = document.createElement('p'); p.textContent = text; p.className = 'dialog-text';
  const close = document.createElement('button'); close.textContent = 'Close'; close.onclick = () => dialog.close();
  dialog.addEventListener('close', () => dialog.remove());
  dialog.append(h, p, close);
  document.body.append(dialog);
  dialog.showModal();
}

const commandRegistry: Record<string, () => void> = {
  save: () => send({type: 'save'}),
  'save-as': () => send({type: 'save-as'}),
  bold: () => { command(toggleMark(schema.marks.strong)); },
  italic: () => { command(toggleMark(schema.marks.em)); },
  inlineCode: () => { command(toggleMark(schema.marks.code)); },
  undo: () => { if (!readOnly) send({type: 'undo'}); },
  redo: () => { if (!readOnly) send({type: 'redo'}); },
  find,
  outline,
  navigate: navigateWithLastMode,
  pinNavigation: togglePinnedNavigation,
  toggleToolbar: toggleToolbarVisibility,
  insert: toggleInsertMenu,
  focusMode: toggleFocusMode,
  help: showHelp,
  exportPdf: () => pdfDialog(send),
  manageIncludes: () => { void manageIncludes(); },
  textSize: textSizeDialog,
  readingWidth: () => {
    const wide = root.classList.toggle('wide-reading');
    readingWidthItem.setAttribute('aria-pressed', String(wide));
  },
  readOnly: () => setMode(!userReadOnly),
  hideToolbar: () => setToolbarHidden(true),
  about: () => information('MarkdownUP', '0.3.0 · Local-first Markdown with editable includes.'),
};

function applyPreferences(preferences: any) {
  if (!preferences || typeof preferences !== 'object') return;
  navigator.setPreferences({
    pinned: typeof preferences.navigationPinned === 'boolean' ? preferences.navigationPinned : undefined,
    mode: preferences.navigationMode === 'outline' || preferences.navigationMode === 'find' ? preferences.navigationMode : undefined,
  });
  if (typeof preferences.toolbarHidden === 'boolean') setToolbarHidden(preferences.toolbarHidden, false);
}
syncToolbar();
sourceFeedback();
updateChrome();

let generation:string | undefined;
let restoration:{uri:string;pieceId:string;id:string;text:string;top:number;position:number;areaStart?:number;focus:boolean}|undefined;
let joinRestoration:typeof restoration;
function restorePosition(){
  if(!restoration)return;const saved=restoration;restoration=undefined;
  const candidates=[...segments.values()].filter(segment=>segment.sourceUri===saved.uri);const segment=candidates.find(segment=>segment.id===saved.id&&segment.text===saved.text)??candidates.find(segment=>segment.text===saved.text)??candidates.find(segment=>segment.pieceId===saved.pieceId);if(!segment)return;
  mountChunk(segmentChunks.get(segment.id)!);const element=elements.get(segment.id)!;
  if(saved.focus&&!readOnly){activate(element,segment);if(active?.view){const view=active.view;view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(Math.min(saved.position,view.state.doc.content.size)))));}else if(active?.area){active.area.setSelectionRange(saved.areaStart??0,saved.areaStart??0);}}
  const align=()=>window.scrollBy(0,element.getBoundingClientRect().top-saved.top);align();requestAnimationFrame(()=>{align();requestAnimationFrame(align);});
}
function appendSegments(batch:Segment[]) {
  const fragment = document.createDocumentFragment();
  let chunk:HTMLElement, group:Segment[] = [];
  const added:HTMLElement[] = [];
  for (const segment of batch) {
    segments.set(segment.id,segment);
    segmentIndices.set(segment.id,segmentOrder.length);segmentOrder.push(segment);
    const key = ownerKey(segment); const owners = ownership.get(key) ?? []; owners.push(segment); ownership.set(key,owners);
    if (group.length === 0 || group.length === 32) {
      chunk = document.createElement('div'); chunk.className = 'chunk'; group = [];
      chunkData.set(chunk,group); fragment.append(chunk); observer.observe(chunk); added.push(chunk);
    }
    group.push(segment); segmentChunks.set(segment.id,chunk!);
  }
  for (const chunk of added) chunk.style.minHeight = `${chunkData.get(chunk)!.reduce((sum,segment) => sum + Math.max(40,segment.text.split('\n').length*24),0)}px`;
  root.append(fragment);
  navigator.add(batch);
}
window.addEventListener('message',event => {
  const message = event.data;
  if(message.type==='result'){const pending=requests.get(message.id);requests.delete(message.id);if(message.error)pending?.reject(new Error(message.error));else pending?.resolve(message.result);return;}
  if(message.type==='command'){
    const label=message.command;
    if(label==='reveal'){
      const source=message.context?.sourceUri?{uri:message.context.sourceUri,pieceId:message.context.pieceId}:active?{uri:active.segment.sourceUri,pieceId:active.segment.pieceId}:undefined;
      if(source)send({type:'reveal',...source});
      return;
    }
    const action=({Bold:'bold',Italic:'italic',Code:'inlineCode',Insert:'insert'} as Record<string,string>)[label]??label;
    const run=commandRegistry[action];
    if(run)run();
    else toast(`Unknown command: ${label}`,'error');
    return;
  }
  if(message.type==='preferences'){applyPreferences(message.preferences);return;}
  if(message.type==='pdf-options'){setPdfDefaults(message.options);return;}
  if(message.type==='diagram-result'){const pending=diagramRequests.get(message.id);diagramRequests.delete(message.id);if(message.error)pending?.reject(new Error(message.error));else pending?.resolve(message.svg);return;}
  if(message.type==='open-export'){pdfDialog(send);return;}
  if (message.type === 'document') {
    if(joinRestoration){restoration=joinRestoration;joinRestoration=undefined;}else if(!message.readOnly){const item=active??[...elements].map(([id,element])=>({segment:segments.get(id)!,element})).find(item=>item.element.getBoundingClientRect().bottom>45&&item.element.getBoundingClientRect().top<innerHeight);if(item)restoration={uri:item.segment.sourceUri,pieceId:item.segment.pieceId,id:item.segment.id,text:item.segment.text,top:item.element.getBoundingClientRect().top,position:active?.view?.state.selection.from??1,areaStart:active?.area?.selectionStart,focus:!!active};}
    const scroll = window.scrollY; const focus = active?.segment.id;
    const savedDraft = active?.area?.value;
    generation = message.generation;
    readOnly = !!message.readOnly || userReadOnly;documentTitle=message.title;sourceFeedback();
    deactivate(); contextPending=false; observer.disconnect(); segments = new Map();segmentOrder=[];segmentIndices.clear(); navigator.reset(); ownership = new Map(); elements.clear(); chunkData.clear(); segmentChunks.clear(); root.replaceChildren(); markdownEnv={};anchorTargets.clear();headingSlugs.clear();
    document.title = message.title;
    appendSegments(message.segments);
    refreshMarkdownContext();
    // Paint the first screen synchronously; parse the rest only near the viewport.
    const firstChunk = chunkData.keys().next().value;
    if (firstChunk) mountChunk(firstChunk);
    if (!restoration && focus && segments.has(focus)) { mountChunk(segmentChunks.get(focus)!); activate(elements.get(focus)!,segments.get(focus)!); if (savedDraft && active?.area) active.area.value = savedDraft; }
    window.scrollTo(0,scroll || vscode.getState()?.scroll || 0);
    status.textContent = readOnly ? 'Preparing editor…' : 'Ready';
    performance.mark('markdownup-first-screen');
    const phase = readOnly ? 'readable' : 'editable';
    requestAnimationFrame(() => send({type:'metrics',phase,timestamp:Date.now()}));
  } else if (message.type === 'append') {
    if (message.generation === generation) {
      appendSegments(message.segments);
    }
  } else if(message.type==='index-complete'&&message.generation===generation){refreshMarkdownContext();restorePosition();
  } else if(message.type==='pieces'){
    const affected=new Set([...message.removed,...message.updated.map((piece:any)=>piece.id)]);
    if(active&&active.segment.sourceUri===message.uri&&affected.has(active.segment.pieceId)){restoration=joinRestoration??{uri:active.segment.sourceUri,pieceId:active.segment.pieceId,id:active.segment.id,text:active.segment.text,top:active.element.getBoundingClientRect().top,position:active.view?.state.selection.from??1,focus:true};deactivate();}joinRestoration=undefined;
    for(const segment of [...segmentOrder]){if(segment.sourceUri!==message.uri)continue;const chunk=segmentChunks.get(segment.id)!;const list=chunkData.get(chunk)!;
      if(message.removed.includes(segment.pieceId)){elements.get(segment.id)?.remove();elements.delete(segment.id);segments.delete(segment.id);navigator.remove(segment.id);list.splice(list.indexOf(segment),1);continue;}
      const update=message.updated.find((piece:any)=>piece.id===segment.pieceId);if(update){segment.text=update.raw;segment.sourceVersion=message.version;navigator.index(segment);const element=elements.get(segment.id);if(element)render(element,segment);}
      for(const item of message.added.filter((item:any)=>item.after===segment.pieceId)){const addition:Segment={...segment,id:segment.includeInstanceId+':'+item.piece.id,pieceId:item.piece.id,text:item.piece.raw,editable:item.piece.editable,blockType:item.piece.blockType};segments.set(addition.id,addition);segmentChunks.set(addition.id,chunk);list.splice(list.indexOf(segment)+1,0,addition);segmentOrder.splice(segmentOrder.indexOf(segment)+1,0,addition);const element=elements.get(segment.id);if(element)element.after(makeSegment(addition));navigator.index(addition);}
    }
    segmentOrder=segmentOrder.filter(segment=>segments.has(segment.id));segmentIndices.clear();segmentOrder.forEach((segment,index)=>segmentIndices.set(segment.id,index));ownership=new Map();for(const segment of segmentOrder){const key=ownerKey(segment);const entries=ownership.get(key)??[];entries.push(segment);ownership.set(key,entries);}navigator.reorder(segmentOrder.map(segment=>segment.id));refreshMarkdownContext();restorePosition();
  } else if (message.type === 'patch') {
    if (message.origin === origin) return;
    for (const segment of ownership.get(`${message.uri}::${message.pieceId}`) ?? []) {
      if (segment.text === message.text) continue;
      segment.text = message.text; segment.sourceVersion = message.version;navigator.index(segment);
      const element = elements.get(segment.id);
      if (!element) continue;
      if (active?.element === element) {
        if (active.area) active.area.value = message.text;
        if (active.view) {
          const selection = Math.min(active.view.state.selection.from,parser.parse(message.text).content.size);
          let state = EditorState.create({schema,doc:parser.parse(message.text),plugins:active.view.state.plugins});
          state = state.apply(state.tr.setSelection(TextSelection.near(state.doc.resolve(selection))));
          active.view.updateState(state);
        }
      } else render(element,segment);
    }
    refreshMarkdownContext();
  } else if (message.type === 'status') {
    if(message.history){historyState=message.history;syncToolbar();}
    const dirty=Array.isArray(message.dirty)?message.dirty.length:0;
    if(lastDirtyCount!==undefined&&lastDirtyCount>0&&dirty===0&&!message.conflicts?.length)toast('All changes saved','success');
    lastDirtyCount=dirty;
    const text=dirty ? `${dirty} unsaved files` : 'Saved';if(status.textContent!==text)status.textContent=text;const title=message.dirty.join('\n');if(status.title!==title)status.title=title;
    const container = document.querySelector('#conflicts')!; container.replaceChildren();
    for (const conflict of message.conflicts) {
      const row = document.createElement('div'); const label = document.createElement('span');
      label.textContent = `${conflict.uri} ${conflict.deleted ? 'was deleted' : 'changed externally'}. Choose an action:`; row.append(label);
      for (const [choice,text] of [['reload','Reload external version'],['keep','Keep editor version'],['diff','View diff']]) {
        const button = document.createElement('button'); button.textContent = text;
        button.onclick = () => send({type:'conflict',uri:conflict.uri,choice}); row.append(button);
      }
      container.append(row);
    }
  } else if (message.type === 'benchmark') {
    const percentile = (values:number[]) => values.sort((a,b) => a-b)[Math.floor(values.length*.95)];
    void (async () => {
      try {
        const first = [...segments.values()].find(segment => segment.editable && !segment.error && segment.text.trim());
        if (!first) throw new Error('No editable block for benchmark.');
        mountChunk(segmentChunks.get(first.id)!); activate(elements.get(first.id)!,first);
        longTasks = [];
        const input:number[] = [], scroll:number[] = [];
        for (let i=0;i<40;i++) {
          const start = performance.now(); document.execCommand('insertText',false,'a');
          await new Promise(requestAnimationFrame); input.push(performance.now()-start);
        }
        for (let i=0;i<40;i++) {
          const start = performance.now(); window.scrollBy(0,Math.min(innerHeight,700));
          await new Promise(requestAnimationFrame); scroll.push(performance.now()-start);
        }
        send({type:'benchmark-result',result:{inputP95Ms:percentile(input),scrollP95Ms:percentile(scroll),maxLongTaskMs:Math.max(0,...longTasks)}});
      } catch (reason) {
        send({type:'benchmark-result',result:{inputP95Ms:0,scrollP95Ms:0,maxLongTaskMs:0,error:String(reason)}});
      }
    })();
  } else if (message.type === 'error') error(message.message);
});
let scrollTimer:ReturnType<typeof setTimeout>;
window.addEventListener('scroll',() => { clearTimeout(scrollTimer); scrollTimer = setTimeout(() => vscode.setState({scroll:window.scrollY}),150); },{passive:true});
send({type:'ready'});
