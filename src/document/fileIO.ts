import { readFile, writeFile, realpath, rename, unlink } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import type { FileIO } from '../shared/types';
export function uriForPath(path:string) {
  return pathToFileURL(path).href.replace(/^file:\/\/\/([a-z]):/i,(_,drive:string) => `file:///${drive.toUpperCase()}:`);
}

export class LocalFileIO implements FileIO {
  validateWrite(uri:string){this.beforeWrite?.(uri);}
  constructor(readonly roots: string[], readonly beforeWrite?: (uri: string) => void) {}
  async read(uri: string) {
    const data = await readFile(fileURLToPath(uri));
    return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(data);
  }
  async write(uri: string, text: string) {
    this.beforeWrite?.(uri);
    const path = fileURLToPath(uri);
    const temporary = `${path}.markdownup-${randomUUID()}.tmp`;
    try { await writeFile(temporary,text,{encoding:'utf8',flag:'wx'}); await rename(temporary,path); }
    finally { await unlink(temporary).catch(() => {}); }
  }
  async resolve(from: string, target: string) {
    if (/^[a-z][a-z\d+.-]*:/i.test(target) || isAbsolute(target) || target.startsWith('\\') || target.includes('\0') || /[?#]/.test(target)) {
      throw new Error(`Only relative local Markdown imports are allowed: ${target}`);
    }
    const candidate = resolve(dirname(fileURLToPath(from)),target.replace(/[\\/]/g,sep));
    if (extname(candidate).toLowerCase() !== '.md') throw new Error(`Only .md imports are supported: ${target}`);
    // Canonicalize symlinks before checking containment; missing paths canonicalize their parent.
    const canonical = await this.canonical(candidate);
    const roots = await Promise.all(this.roots.map(root => this.canonical(root)));
    if (!roots.some(root => { const rel = relative(root,canonical); return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel)); })) {
      throw new Error(`Include is outside the workspace: ${target}`);
    }
    return uriForPath(canonical);
  }
  private async canonical(path: string): Promise<string> {
    try { return await realpath(path); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const parent = dirname(path);
      if (parent === path) throw error;
      return resolve(await this.canonical(parent),relative(parent,path));
    }
  }
}
