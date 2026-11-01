import { chromium,type Browser,type Page } from 'playwright-core';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
export class DiagramService {
  private browser?:Promise<Browser>;
  private workers:{page?:Page;busy:boolean}[]=[{busy:false},{busy:false}];
  private jobs:{code:string;dark:boolean;key:string;priority:number;signal?:AbortSignal;resolve:(svg:string)=>void;reject:(error:unknown)=>void}[]=[];
  private idle?:ReturnType<typeof setTimeout>;
  private firstCompleted=false;
  private cache=new Map<string,string>();
  private prepare?:Promise<void>;
  private warmed=false;
  constructor(private extensionPath:string){}
  /**
   * Pay the browser launch, runtime load and parser warm-up while the document
   * is still being indexed. Requests wait for this promise instead of racing a
   * second renderer page.
   */
  prewarm(){
    if(this.prepare||this.warmed)return;
    this.prepare=(async()=>{
      const page=await this.page(this.workers[0]);
      await page.evaluate(async()=>{const mermaid=(window as any).mermaidRuntime;mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'default',fontFamily:'Segoe UI, Microsoft YaHei, sans-serif',maxTextSize:100000,maxEdges:1000,suppressErrorRendering:true});try{await mermaid.render('markdownup-warmup','flowchart LR\n A --> B');}catch{/* Warm-up is best effort. */}finally{document.body.replaceChildren();}});
      this.warmed=true;
    })().catch(()=>{/* A real render will report the actionable error. */}).finally(()=>{this.prepare=undefined;});
  }
  render(code:string,dark:boolean,priority=0,signal?:AbortSignal):Promise<string>{
    const key=`${dark}:${code}`;const cached=this.cache.get(key);if(cached)return Promise.resolve(cached);
    if(this.prepare)return this.prepare.then(()=>this.render(code,dark,priority,signal));
    return new Promise((resolve,reject)=>{this.jobs.push({code,dark,key,priority,signal,resolve,reject});this.jobs.sort((a,b)=>a.priority-b.priority);this.pump();});
  }
  private pump(){
    clearTimeout(this.idle);
    for(const worker of this.workers){if(worker.busy)continue;const job=this.jobs.shift();if(!job)break;
      // Compiling two Mermaid runtimes at once delays the first visible graph.
      // Start the second worker after the first job, then use the full pool.
      if(!this.firstCompleted&&this.workers.some(item=>item.busy)){this.jobs.unshift(job);break;}
      if(job.signal?.aborted){job.reject(new Error('Diagram cancelled'));this.pump();return;}
      worker.busy=true;void this.execute(worker,job).then(job.resolve,job.reject).finally(()=>{this.firstCompleted=true;worker.busy=false;this.pump();});
    }
    if(!this.jobs.length&&!this.workers.some(worker=>worker.busy))this.idle=setTimeout(()=>this.release(),30000);
  }
  private async page(worker:typeof this.workers[number]){
    this.browser??=chromium.launch({executablePath:join(this.extensionPath,'engine','chrome-headless-shell.exe'),headless:true}).catch(error=>{this.browser=undefined;throw error;});
    if(!worker.page||worker.page.isClosed()){
      const page=await(await this.browser).newPage({deviceScaleFactor:2});await page.route('**/*',route=>route.abort());await page.setContent('<html><body></body></html>');
      await page.addScriptTag({path:join(this.extensionPath,'dist','mermaid-runtime.js')});worker.page=page;
    }return worker.page;
  }
  private async execute(worker:typeof this.workers[number],job:typeof this.jobs[number]){
    const cached=this.cache.get(job.key);if(cached)return cached;
    const page=await this.page(worker);let timedOut=false;
    const abort=()=>{void page.close();};job.signal?.addEventListener('abort',abort,{once:true});
    const timeout=setTimeout(()=>{timedOut=true;void page.close();},15000);
    try{
      if(job.signal?.aborted)throw new Error('Diagram cancelled');
      const svg=await page.evaluate(async({code,dark,id})=>{const mermaid=(window as any).mermaidRuntime;mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:dark?'dark':'default',fontFamily:'Segoe UI, Microsoft YaHei, sans-serif',maxTextSize:100000,maxEdges:1000,suppressErrorRendering:true});try{return(await mermaid.render(id,code)).svg;}finally{document.body.replaceChildren();}},{code:job.code,dark:job.dark,id:'diagram-'+randomUUID()});
      this.cache.set(job.key,svg);let bytes=0;for(const [key,value]of [...this.cache].reverse()){bytes+=2*(key.length+value.length);if(bytes>16*1024*1024)this.cache.delete(key);}if(this.cache.size>128)this.cache.delete(this.cache.keys().next().value!);return svg;
    }catch(error){if(timedOut)throw new Error('Diagram exceeded the 15-second rendering limit. Simplify the diagram.',{cause:error});throw error;}
    finally{clearTimeout(timeout);job.signal?.removeEventListener('abort',abort);}
  }
  async png(code:string,dark:boolean){
    const svg=await this.render(code,dark);const page=await this.page({busy:false});
    try{await page.route('**/*',route=>route.abort());await page.setContent(`<html><body style="margin:0;background:white">${svg}</body></html>`);await page.evaluate(()=>document.fonts.ready);const target=page.locator('svg');const box=await target.boundingBox();if(!box||box.width*box.height>16000000)throw new Error('Diagram is too large for PNG. Export SVG instead.');return await target.screenshot({type:'png'});}finally{await page.close();this.pump();}
  }
  private release(){const browser=this.browser;this.browser=undefined;this.firstCompleted=false;this.prepare=undefined;this.warmed=false;for(const worker of this.workers)worker.page=undefined;if(browser)void browser.then(value=>value.close()).catch(()=>{});}
  dispose(){clearTimeout(this.idle);for(const job of this.jobs.splice(0))job.reject(new Error('Renderer closed'));this.release();}
}
