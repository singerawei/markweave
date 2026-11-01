import {Plugin,PluginKey}from 'prosemirror-state';
import {Decoration,DecorationSet}from 'prosemirror-view';
import type {Command}from 'prosemirror-state';
import {highlight,codeLanguages}from './diagrams';
import {modifierLabel}from './shortcuts';
import type{NodeView,EditorView}from'prosemirror-view';
import type{Node}from'prosemirror-model';

export const indentCode=(outdent=false):Command=>(state,dispatch)=>{
  const {$from,from,to}=state.selection;if(!$from.parent.type.spec.code)return false;
  const start=$from.start(),text=$from.parent.textContent;const first=text.lastIndexOf('\n',from-start-1)+1;
  const starts=[first];for(let offset=text.indexOf('\n',first);offset>=0&&offset<to-start;offset=text.indexOf('\n',offset+1))starts.push(offset+1);
  const tr=state.tr;for(const offset of starts.reverse()){if(outdent){const length=/^(?:\t| {1,2})/.exec(text.slice(offset))?.[0].length??0;if(length)tr.delete(start+offset,start+offset+length);}else tr.insertText('  ',start+offset);}
  dispatch?.(tr);return true;
};
export const newlineCode:Command=(state,dispatch)=>{const {$from}=state.selection;if(!$from.parent.type.spec.code)return false;const prefix=$from.parent.textContent.slice(0,$from.parentOffset).split('\n').pop()!;dispatch?.(state.tr.insertText('\n'+(/^\s*/.exec(prefix)?.[0]??'')));return true;};
export function codeNodeView(node:Node,view:EditorView,getPos:()=>number|undefined):NodeView{
  const dom=document.createElement('div');dom.className='editing-code';const header=document.createElement('div');header.className='block-tools';header.contentEditable='false';
  const language=document.createElement('select');language.setAttribute('aria-label','Code language');
  const current=String(node.attrs.params??'').split(/\s/)[0];for(const value of new Set([current,...codeLanguages])){const option=document.createElement('option');option.value=value;option.textContent=value||'plain text';language.append(option);}language.value=current;
  language.onchange=()=>{const pos=getPos();if(pos!==undefined){view.dispatch(view.state.tr.setNodeMarkup(pos,undefined,{...node.attrs,params:language.value}));view.focus();}};
  const hint=document.createElement('small');hint.textContent=`Tab / Shift+Tab: indent · ${modifierLabel()}+Enter: exit`;header.append(language,hint);
  const pre=document.createElement('pre'),contentDOM=document.createElement('code');pre.append(contentDOM);dom.append(header,pre);
  return {dom,contentDOM,stopEvent:event=>header.contains(event.target as globalThis.Node),ignoreMutation:mutation=>header.contains(mutation.target),update(next){if(next.type!==node.type)return false;node=next;language.value=String(node.attrs.params??'').split(/\s/)[0];return true;}};
}
export function codeHighlightPlugin(){
  const key=new PluginKey<DecorationSet>('code-highlights');
  return new Plugin<DecorationSet>({key,state:{init:()=>DecorationSet.empty,apply(tr,old){return tr.getMeta(key)??old.map(tr.mapping,tr.doc);}},props:{decorations:state=>key.getState(state)},
    view(view){let timer:ReturnType<typeof setTimeout>;let revision=0;let last=view.state.doc;const schedule=()=>{clearTimeout(timer);const expected=++revision;timer=setTimeout(()=>{
      if(expected!==revision)return;const decorations:Decoration[]=[];view.state.doc.descendants((node,pos)=>{if(node.type.name!=='code_block'||node.textContent.length>128*1024)return;
        // Bound decoration count while editing large code. Color a line-aligned
        // window around the caret; the full source and static preview stay intact.
        const text=node.textContent,caret=Math.max(0,Math.min(text.length,view.state.selection.from-pos-1));
        const left=Math.max(0,caret-4096),right=Math.min(text.length,caret+4096),lineStart=text.lastIndexOf('\n',left),lineEnd=text.indexOf('\n',right);
        const start=text.length>16384?(lineStart>=left-1024?lineStart+1:left):0;
        const end=text.length>16384?(lineEnd>=0&&lineEnd<=right+1024?lineEnd:right):text.length;
        const html=highlight(text.slice(start,end),String(node.attrs.params??'').split(/\s/)[0]);const holder=document.createElement('div');holder.innerHTML=html;let offset=pos+1+start;
        const walk=(parent:globalThis.Node,classes:string[])=>{for(const child of parent.childNodes){if(child.nodeType===3){const length=child.textContent?.length??0;if(length&&classes.length)decorations.push(Decoration.inline(offset,offset+length,{class:classes.join(' ')}));offset+=length;}else if(child instanceof HTMLElement)walk(child,[...classes,...child.classList]);}};walk(holder,[]);
      });view.dispatch(view.state.tr.setMeta(key,DecorationSet.create(view.state.doc,decorations)).setMeta('addToHistory',false));},120);};let selection=view.state.selection.from;schedule();return {update(){const moved=selection!==view.state.selection.from;selection=view.state.selection.from;if(view.state.doc!==last||(moved&&view.state.selection.$from.parent.textContent.length>16384)){last=view.state.doc;schedule();}},destroy(){revision++;clearTimeout(timer);}};}
  });
}
