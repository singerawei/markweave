import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
export function markdown(bytes:number) {
  const block = '# Architecture\n\nLocal-first design with **source ownership**, *Markdown* and [links](./child.md).\n\n- One\n- Two\n- [x] Verified\n\n| Module | State |\n| --- | --- |\n| Storage | Local |\n\n```ts\nconst source = "Markdown";\n```\n\n![Diagram](./diagram.png)\n\n';
  return block.repeat(Math.ceil(bytes / Buffer.byteLength(block))).slice(0,bytes);
}
export function markdownWithDiagrams(bytes:number,count:number){
  return '# Architecture\n\n'+Array.from({length:count},(_,i)=>`\n\n\`\`\`mermaid\nflowchart LR\n A[Start ${i}] --> B[Finish ${i}]\n\`\`\`\n\n`+markdown(Math.max(1,Math.floor(bytes/count)-80))).join('');
}
export async function generate(directory:string) {
  await mkdir(directory,{recursive:true});
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMioAAAAASUVORK5CYII=','base64');
  await writeFile(join(directory,'diagram.png'),image);
  await writeFile(join(directory,'M-1MB-20-diagrams.md'),markdownWithDiagrams(1024*1024,20));
  await writeFile(join(directory,'M-5MB-100-diagrams.md'),markdownWithDiagrams(5*1024*1024,100));
  for (const [name,bytes] of [['A-100KB',100*1024],['B-1MB',1024*1024],['C-5MB',5*1024*1024]] as const) await writeFile(join(directory,`${name}.md`),markdown(bytes));
  for (const [name,count,total] of [['D-100-includes',100,5*1024*1024],['E-500-includes',500,5*1024*1024]] as const) {
    const folder = join(directory,name); await mkdir(folder,{recursive:true});
    await writeFile(join(folder,'diagram.png'),image);
    await writeFile(join(folder,'MASTER.md'),'# Composite\n\n'+Array.from({length:count},(_,i) => `@import "./part-${i}.md"\n\n`).join(''));
    await Promise.all(Array.from({length:count},(_,i) => writeFile(join(folder,`part-${i}.md`),markdown(Math.ceil(total/count)))));
    if(count===100){const mixed=join(directory,'M-composite');await mkdir(mixed,{recursive:true});await writeFile(join(mixed,'diagram.png'),image);await writeFile(join(mixed,'MASTER.md'),'# Architecture\n\n'+Array.from({length:100},(_,i)=>`@import "./part-${i}.md"\n\n`).join(''));await Promise.all(Array.from({length:100},(_,i)=>writeFile(join(mixed,`part-${i}.md`),markdownWithDiagrams(Math.ceil(total/100),1).replace('Start 0',`Start ${i}`))));}
  }
}
