import * as vscode from 'vscode';
import { EditorProvider } from './editorProvider';

export function activate(context: vscode.ExtensionContext) {
  const provider = new EditorProvider(context);
  const actions: Record<string, string> = {
    save: 'save',
    saveAs: 'save-as',
    bold: 'bold',
    italic: 'italic',
    inlineCode: 'inlineCode',
    undo: 'undo',
    redo: 'redo',
    find: 'find',
    outline: 'outline',
    navigate: 'navigate',
    pinNavigation: 'pinNavigation',
    toggleToolbar: 'toggleToolbar',
    focusMode: 'focusMode',
    help: 'help',
    manageIncludes: 'manageIncludes',
    insert: 'insert',
    revealSource: 'reveal',
  };
  for (const [name, action] of Object.entries(actions)) {
    context.subscriptions.push(vscode.commands.registerCommand(`markweave.${name}`, (item?: unknown) => provider.dispatch(action, item)));
  }
  context.subscriptions.push(
    vscode.commands.registerCommand('markweave.exportPdf', () => provider.openExport()),
    vscode.commands.registerCommand('markweave.open', async () => {
      const uri = vscode.window.activeTextEditor?.document.uri;
      if (uri) await vscode.commands.executeCommand('vscode.openWith', uri, EditorProvider.viewType);
    }),
    provider,
    vscode.window.registerCustomEditorProvider(EditorProvider.viewType, provider, {
      webviewOptions: {retainContextWhenHidden: false},
      supportsMultipleEditorsPerDocument: true,
    }),
  );
  return {provider};
}
