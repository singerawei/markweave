import { build } from 'esbuild';
import { mkdir, copyFile,cp } from 'node:fs/promises';
import './licenses.mjs';
await mkdir('dist', { recursive: true });
await Promise.all([
  build({entryPoints:['src/extension/extension.ts'],outfile:'dist/extension.js',bundle:true,platform:'node',format:'cjs',target:'node20',external:['vscode','playwright-core'],minify:true}),
  build({entryPoints:['src/webview/editor.ts'],outfile:'dist/editor.js',bundle:true,platform:'browser',format:'iife',target:'chrome120',minify:true}),
  build({entryPoints:['src/webview/exportRenderer.ts'],outfile:'dist/export-renderer.js',bundle:true,platform:'browser',format:'iife',target:'chrome120',minify:true}),
  build({entryPoints:['src/webview/mermaidRuntime.ts'],outfile:'dist/mermaid-runtime.js',bundle:true,platform:'browser',format:'iife',target:'chrome120',minify:true}),
  build({entryPoints:['tests/integration/vscode.ts'],outfile:'dist/host-tests.cjs',bundle:true,platform:'node',format:'cjs',target:'node20',external:['vscode']}),
  copyFile('src/webview/editor.css','dist/editor.css')
]);
await cp('node_modules/playwright-core','dist/node_modules/playwright-core',{recursive:true});
