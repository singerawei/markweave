import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json','utf8')) as {
  contributes: {
    commands: {command: string}[];
    keybindings: {command: string; key: string; mac: string; when: string}[];
  };
};
const commandIds = new Set(pkg.contributes.commands.map(command => command.command));
const bindings = pkg.contributes.keybindings;
const editorScope = 'activeCustomEditorId == markweave.editor';

test('every default keybinding targets a contributed command in the MarkWeave editor',()=>{
  for(const binding of bindings){
    assert.ok(commandIds.has(binding.command),`Missing command contribution: ${binding.command}`);
    assert.equal(binding.when,editorScope,`Unscoped keybinding: ${binding.command}`);
    assert.match(binding.key,/(?:ctrl|alt|shift)\+/i,`Unplatformed PC key: ${binding.command}`);
    assert.match(binding.mac,/^(?:cmd|ctrl|alt|shift)\+/i,`Unplatformed Mac key: ${binding.command}`);
  }
  const signatures = bindings.map(binding => `${binding.command}|${binding.key}|${binding.when}`);
  assert.equal(new Set(signatures).size,signatures.length,'Duplicate keybinding signature');
});

test('required high-frequency commands have defaults and fallbacks',()=>{
  const required = ['markweave.save','markweave.saveAs','markweave.find','markweave.outline','markweave.pinNavigation','markweave.toggleToolbar','markweave.insert','markweave.focusMode','markweave.help'];
  for(const command of required){
    assert.ok(commandIds.has(command),`Missing command: ${command}`);
    assert.ok(bindings.some(binding => binding.command === command),`Missing default keybinding: ${command}`);
  }
  assert.ok(bindings.filter(binding => binding.command === 'markweave.outline').length >= 2,'Outline needs a documented fallback binding');
});

test('disabled-state and accessible chrome contracts are present',()=>{
  const editor = readFileSync('src/webview/editor.ts','utf8');
  const navigation = readFileSync('src/webview/navigation.ts','utf8');
  const css = readFileSync('src/webview/editor.css','utf8');
  assert.match(editor,/aria-keyshortcuts/);
  assert.match(editor,/aria-pressed/);
  assert.match(editor,/commandRegistry/);
  assert.doesNotMatch(editor,/querySelector<HTMLButtonElement>\('#toolbar button\[aria-label=/);
  assert.match(navigation,/aria-current/);
  assert.match(navigation,/aria-pressed/);
  assert.match(css,/#navigation\{position:fixed/);
  assert.match(css,/\.navigation-result\[aria-current=location\]/);
  assert.doesNotMatch(css,/#source-status/);
  assert.doesNotMatch(css,/\.focus-mode #toolbar\{opacity/);
});
