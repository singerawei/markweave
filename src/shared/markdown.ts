import MarkdownIt from 'markdown-it';
export function markdownTokenizer(html=false){
  const md=new MarkdownIt({html,linkify:false,breaks:false});
  md.core.ruler.after('inline','task_lists',state=>{const tokens=state.tokens;for(let i=0;i<tokens.length-2;i++){
    if(tokens[i].type!=='list_item_open'||tokens[i+2].type!=='inline')continue;const inline=tokens[i+2];const match=/^\[([ xX])\] /.exec(inline.content);if(!match)continue;
    tokens[i].attrSet('data-checked',String(match[1]!==' '));inline.content=inline.content.slice(4);if(inline.children?.[0]?.type==='text')inline.children[0].content=inline.children[0].content.replace(/^\[([ xX])\] /,'');
  }});return md;
}
