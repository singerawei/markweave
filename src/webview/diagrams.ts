import hljs from 'highlight.js/lib/common';
import protobuf from 'highlight.js/lib/languages/protobuf';
import cmake from 'highlight.js/lib/languages/cmake';
hljs.registerLanguage('protobuf',protobuf);hljs.registerAliases(['proto'],{languageName:'protobuf'});hljs.registerLanguage('cmake',cmake);
hljs.registerAliases(['c++','cxx'],{languageName:'cpp'});
export const codeLanguages=['plaintext','cpp','c','protobuf','typescript','javascript','python','json','yaml','bash','sql','rust','java','csharp','go','xml','html','css','cmake'];
const cache = new Map<string,string>();
let queue = Promise.resolve();
let sequence = 0;
let runtime:Promise<any> | undefined;
const script=document.currentScript as HTMLScriptElement | null;
const runtimeUrl=script?.src ? new URL('mermaid-runtime.js',script.src).href : '';
const nonce=script?.nonce;
let remote:((code:string,dark:boolean,needed:()=>boolean,priority:number)=>Promise<string>) | undefined;
export function setDiagramRenderer(renderer:(code:string,dark:boolean,needed:()=>boolean,priority:number)=>Promise<string>){remote=renderer;}
export function highlight(code:string,language:string) {
  return language && hljs.getLanguage(language) ? hljs.highlight(code,{language,ignoreIllegals:true}).value : escape(code);
}
function escape(value:string) { return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
export function diagram(code:string,dark=false,needed:()=>boolean=()=>true,priority=0):Promise<string> {
  const key = `${dark}:${code}`;
  const existing = cache.get(key); if (existing) return Promise.resolve(existing);
  const render=async () => {
    const cached = cache.get(key); if (cached) return cached;
    if(!needed())throw new Error('Diagram request superseded.');
    if(remote){const svg=await remote(code,dark,needed,priority);cache.set(key,svg);if(cache.size>128)cache.delete(cache.keys().next().value!);return svg;}
    await new Promise(resolve => setTimeout(resolve,0));
    runtime ??= (window as any).mermaidRuntime ? Promise.resolve((window as any).mermaidRuntime) : new Promise((resolve,reject)=>{
      const element=document.createElement('script');element.src=runtimeUrl;if(nonce)element.nonce=nonce;
      element.onload=()=>resolve((window as any).mermaidRuntime);element.onerror=()=>{runtime=undefined;reject(new Error('Unable to load bundled Mermaid renderer.'));};document.head.append(element);
    });
    const mermaid=await runtime;
    mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:dark?'dark':'default',fontFamily:'Segoe UI, Microsoft YaHei, sans-serif',maxTextSize:100000,maxEdges:1000,suppressErrorRendering:true});
    const {svg} = await mermaid.render(`diagram-${++sequence}`,code);
    cache.set(key,svg); if (cache.size > 128) cache.delete(cache.keys().next().value!);
    return svg;
  };
  // Remote pages have their own bounded pool; do not serialize requests again here.
  // Segment renderers build detached DOM before appending their chunk. Defer
  // the liveness check until that synchronous mount has completed.
  const result=remote?Promise.resolve().then(render):queue.then(render);
  if(!remote)queue = result.then(() => {},() => {}); return result;
}
