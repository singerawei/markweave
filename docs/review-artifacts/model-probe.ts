import { SourceRepository } from '../../src/document/sourceFile';
import { DocumentGraph } from '../../src/document/documentGraph';
import { mkdir,writeFile } from 'node:fs/promises';

async function main() {
  const root='file:///C:/review/MASTER.md',child='file:///C:/review/child.md';
  const files:Record<string,string>={[root]:'Root text\n\n@import "./child.md"\n',[child]:'Child text\n'};
  const writes:string[]=[];
  const repository=new SourceRepository({read:async uri=>files[uri],write:async(uri,text)=>{files[uri]=text;writes.push(uri);},resolve:async(from,path)=>new URL(path,from).href});
  const graph=new DocumentGraph(repository,root);await graph.build();
  for(const uri of [root,child]){
    const piece=repository.sources.get(uri)!.pieces.find(piece=>piece.kind==='markdown')!;
    repository.apply([{uri,pieceId:piece.id,before:piece.raw,after:piece.raw.replace('text','edited')}]);
  }
  files[child]='External child text\n';await repository.external(child);
  let saveError='';try{await repository.save(graph.sourceUris);}catch(error){saveError=String(error);}
  const result={timestamp:new Date().toISOString(),scope:'In-memory SourceRepository using production TypeScript modules',knownConflictPartialSave:{writes,saveError,rootDisk:files[root],childDisk:files[child],dirtySources:[...repository.sources.values()].filter(source=>source.dirty).map(source=>source.uri)}};
  await mkdir('docs/review-artifacts',{recursive:true});await writeFile('docs/review-artifacts/model-probe.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}
void main();
