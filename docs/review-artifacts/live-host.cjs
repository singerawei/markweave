const vscode = require('vscode');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
exports.run = async function () {
  const extension = vscode.extensions.getExtension('markdownup.markdownup');
  await extension.activate();
  const provider = extension.exports.provider;
  const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const documents = () => [...provider.documents];
  await new Promise(async done => {
    const server = http.createServer(async (request, response) => {
      try {
        let body = ''; for await (const chunk of request) body += chunk;
        const input = body ? JSON.parse(body) : {};
        let result;
        if (request.url === '/open') {
          const file = path.resolve(root, input.file);
          const relative = path.relative(root, file);
          if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Outside review workspace');
          const startedAt = Date.now();
          await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(file), 'markdownup.editor');
          result = { startedAt, file };
        } else if (request.url === '/metrics') {
          result = { vscode: vscode.version, documents: documents().map(doc => ({file: doc.uri.fsPath, openedAt: doc.openedAt, metrics: doc.metrics, segments: doc.graph.segments.length, dirtySources: [...doc.dirtySources], sourceCount: doc.graph.sourceUris.size})) };
        } else if (request.url === '/close') {
          for (const document of documents()) if (document.dirtySources.size) await provider.revertCustomDocument(document);
          await vscode.commands.executeCommand('workbench.action.closeAllEditors');
          result = { closed: true };
        } else if (request.url === '/save') {
          const document = documents().find(doc => [...doc.panels].some(panel => panel.active));
          const before = Date.now(); await provider.saveCustomDocument(document);
          result = { ms: Date.now() - before, dirtySources: [...document.dirtySources] };
        } else if (request.url === '/theme') {
          if(!['Default Dark Modern','Default Light Modern','Default High Contrast'].includes(input.name)) throw Error('Unknown review theme');
          await vscode.workspace.getConfiguration('workbench').update('colorTheme',input.name,vscode.ConfigurationTarget.Global);
          result={theme:input.name};
        } else if (request.url === '/quit') {
          result = { closing: true }; setTimeout(() => { server.close(); done(); }, 100);
        } else throw Error('Unknown route');
        response.writeHead(200, {'content-type':'application/json'}); response.end(JSON.stringify(result));
      } catch (error) { response.writeHead(500, {'content-type':'application/json'}); response.end(JSON.stringify({error:String(error)})); }
    });
    server.listen(0, '127.0.0.1', async () => {
      await fs.writeFile(process.env.MARKDOWNUP_REVIEW_READY, JSON.stringify({port:server.address().port, root, vscode:vscode.version}));
      console.log('MARKDOWNUP_LIVE_REVIEW_READY');
    });
  });
};
