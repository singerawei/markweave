import {markdownTokenizer} from '../shared/markdown';
import { Schema } from 'prosemirror-model';
import { schema as basic, MarkdownParser, MarkdownSerializer, defaultMarkdownParser, defaultMarkdownSerializer } from 'prosemirror-markdown';
import { tableNodes } from 'prosemirror-tables';

export {markdownTokenizer};
const lists = basic.spec.nodes.update('list_item',{
  ...basic.spec.nodes.get('list_item')!,attrs:{checked:{default:null}},
  parseDOM:[{tag:'li',getAttrs:dom => ({checked:dom.getAttribute('data-checked') === null ? null : dom.getAttribute('data-checked') === 'true'})}],
  toDOM:node => ['li',node.attrs.checked === null ? {} : {'data-checked':String(node.attrs.checked),role:'checkbox','aria-checked':String(node.attrs.checked),tabindex:0},0]
});
export const schema = new Schema({
  nodes:lists.append(tableNodes({tableGroup:'block',cellContent:'inline*',cellAttributes:{align:{default:null,getFromDOM:dom => dom.style.textAlign || null,setDOMAttr:(value,attrs) => { if (value) attrs.style = `text-align:${value}`; }}}})),
  marks:basic.spec.marks.addToEnd('strike',{parseDOM:[{tag:'s'},{tag:'del'}],toDOM:() => ['s',0]})
});
export const parser = new MarkdownParser(schema,markdownTokenizer(),{
  ...defaultMarkdownParser.tokens,
  list_item:{block:'list_item',getAttrs:token => ({checked:token.attrGet('data-checked') === null ? null : token.attrGet('data-checked') === 'true'})},
  s:{mark:'strike'},table:{block:'table'},thead:{ignore:true},tbody:{ignore:true},tr:{block:'table_row'},
  th:{block:'table_header',getAttrs:token => ({align:token.attrGet('style')?.replace('text-align:','') ?? null})},
  td:{block:'table_cell',getAttrs:token => ({align:token.attrGet('style')?.replace('text-align:','') ?? null})}
});
export const serializer = new MarkdownSerializer({
  ...defaultMarkdownSerializer.nodes,
  list_item(state,node) {
    if (node.attrs.checked !== null) state.write(node.attrs.checked ? '[x] ' : '[ ] ');
    state.renderContent(node);
  },
  table(state,node) {
    node.forEach((row,_,index) => {
      state.write('| ');
      row.forEach(cell => {
        // GFM table cells are inline only. Escape pipes even inside code spans.
        const temp = serializer.serialize(schema.nodes.doc.create(null,schema.nodes.paragraph.create(null,cell.content)));
        state.write(temp.replace(/\|/g,'\\|').replace(/\n/g,' ') + ' | ');
      });
      state.ensureNewLine();
      if (index === 0) {
        state.write('| ');
        row.forEach(cell => state.write((cell.attrs.align === 'center' ? ':---:' : cell.attrs.align === 'right' ? '---:' : cell.attrs.align === 'left' ? ':---' : '---') + ' | '));
        state.ensureNewLine();
      }
    });
    state.closeBlock(node);
  }
},{...defaultMarkdownSerializer.marks,strike:{open:'~~',close:'~~',mixable:true,expelEnclosingWhitespace:true}});
