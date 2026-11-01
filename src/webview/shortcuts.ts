export type ShortcutId =
  | 'save'
  | 'saveAs'
  | 'find'
  | 'outline'
  | 'pinNavigation'
  | 'toggleToolbar'
  | 'insert'
  | 'focusMode'
  | 'help'
  | 'bold'
  | 'italic'
  | 'undo'
  | 'redo'
  | 'exportPdf';

interface ShortcutDefinition {
  key: string;
  aria: string;
}

const windowsShortcuts: Record<ShortcutId, ShortcutDefinition> = {
  save: {key: 'Ctrl+S', aria: 'Control+S'},
  saveAs: {key: 'Ctrl+Shift+S', aria: 'Control+Shift+S'},
  find: {key: 'Ctrl+F', aria: 'Control+F'},
  outline: {key: 'Ctrl+Shift+O', aria: 'Control+Shift+O'},
  pinNavigation: {key: 'Ctrl+Alt+P', aria: 'Control+Alt+P'},
  toggleToolbar: {key: 'Ctrl+Alt+T', aria: 'Control+Alt+T'},
  insert: {key: 'Ctrl+Alt+I', aria: 'Control+Alt+I'},
  focusMode: {key: 'Ctrl+Alt+F', aria: 'Control+Alt+F'},
  help: {key: '? / Ctrl+Alt+H', aria: 'Shift+/ Control+Alt+H'},
  bold: {key: 'Ctrl+B', aria: 'Control+B'},
  italic: {key: 'Ctrl+I', aria: 'Control+I'},
  undo: {key: 'Ctrl+Z', aria: 'Control+Z'},
  redo: {key: 'Ctrl+Shift+Z', aria: 'Control+Shift+Z'},
  exportPdf: {key: 'Ctrl+Alt+E', aria: 'Control+Alt+E'},
};

const macShortcuts: Record<ShortcutId, ShortcutDefinition> = Object.fromEntries(
  Object.entries(windowsShortcuts).map(([id, shortcut]) => [id, {
    key: shortcut.key.replace('Ctrl+', 'Cmd+'),
    aria: shortcut.aria.replace('Control+', 'Meta+'),
  }]),
) as Record<ShortcutId, ShortcutDefinition>;

function isMac() {
  if (typeof navigator === 'undefined') return false;
  const platform = (navigator as Navigator & {userAgentData?: {platform?: string}}).userAgentData?.platform ?? navigator.platform ?? '';
  return /Mac|iPhone|iPad|iPod/i.test(platform);
}

export function shortcutLabel(id: ShortcutId) {
  return (isMac() ? macShortcuts : windowsShortcuts)[id].key;
}

export function shortcutAria(id: ShortcutId) {
  return (isMac() ? macShortcuts : windowsShortcuts)[id].aria;
}

/** Platform-correct primary modifier for inline hints. */
export function modifierLabel() {
  return isMac() ? 'Cmd' : 'Ctrl';
}

export function commandLabel(label: string, id?: ShortcutId) {
  return id ? `${label} (${shortcutLabel(id)})` : label;
}
