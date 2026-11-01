import type {Segment} from '../shared/types';
import {shortcutAria, shortcutLabel} from './shortcuts';

export type NavigationMode = 'find' | 'outline';

export interface NavigationPreferenceState {
  pinned?: boolean;
  mode?: NavigationMode;
}

export interface NavigationOptions {
  /** Jump to a result. `alignTop` places the block below the toolbar. */
  jump: (segment: Segment, query?: string, alignTop?: boolean) => void;
  /** Element that should receive focus when the panel closes. */
  getEditorTarget: () => HTMLElement | undefined;
  /** Bottom edge of the sticky toolbar in viewport coordinates. */
  getToolbarBottom: () => number;
  /** The scrollable document root. */
  getDocumentRoot: () => HTMLElement;
  onPreferenceChange?: (patch: NavigationPreferenceState) => void;
  /** Notifies the shell so the Navigate button can expose aria-expanded. */
  onVisibilityChange?: (open: boolean) => void;
  /** Elements that toggle the panel; clicking them must not count as "outside". */
  isTrigger?: (target: Node) => boolean;
  initialPinned?: boolean;
  initialMode?: NavigationMode;
}

interface Entry {
  segment: Segment;
  order: number;
  text: string;
  heading?: string;
  level: number;
}

const PAGE_SIZE = 40;
const CURRENT_HEADING_DELAY = 60;

export class DocumentNavigation {
  readonly element = document.createElement('aside');
  private readonly entries = new Map<string, Entry>();
  private headingIds: string[] = [];
  private headingOrders: number[] = [];
  private readonly headingRanks = new Map<string, number>();
  private mode: NavigationMode;
  private query = '';
  private page = 0;
  private matches: Entry[] = [];
  private cursor = -1;
  private currentId: string | undefined;
  private pinned: boolean;
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private currentTimer?: ReturnType<typeof setTimeout>;
  private lastFocus?: HTMLElement;
  private lastOpener?: HTMLElement;
  private readonly tabs = document.createElement('div');
  private readonly findTab = document.createElement('button');
  private readonly outlineTab = document.createElement('button');
  private readonly pinButton = document.createElement('button');
  private readonly closeButton = document.createElement('button');
  private readonly findRow = document.createElement('label');
  private readonly input = document.createElement('input');
  private readonly summary = document.createElement('span');
  private readonly results = document.createElement('div');
  private readonly pagination = document.createElement('div');
  private readonly panelId = `navigation-${Math.random().toString(36).slice(2)}`;

  constructor(private readonly options: NavigationOptions) {
    this.mode = options.initialMode === 'outline' ? 'outline' : 'find';
    this.pinned = !!options.initialPinned;
    this.element.id = 'navigation';
    this.element.hidden = true;
    this.element.className = 'navigation-panel';
    this.element.setAttribute('aria-label', 'Document navigation');

    this.tabs.className = 'navigation-tabs';
    this.tabs.setAttribute('role', 'tablist');
    this.tabs.setAttribute('aria-label', 'Navigation mode');
    this.configureTab(this.findTab, 'Find', 'find');
    this.configureTab(this.outlineTab, 'Outline', 'outline');
    this.findTab.id = `${this.panelId}-find-tab`;
    this.outlineTab.id = `${this.panelId}-outline-tab`;
    this.tabs.append(this.findTab, this.outlineTab);

    this.pinButton.type = 'button';
    this.pinButton.className = 'navigation-pin';
    this.pinButton.onclick = () => this.togglePinned();
    this.closeButton.type = 'button';
    this.closeButton.className = 'navigation-close';
    this.closeButton.textContent = 'Close';
    this.closeButton.setAttribute('aria-label', 'Close navigation');
    this.closeButton.onclick = () => this.close({restoreFocus: true, force: true});

    const header = document.createElement('div');
    header.className = 'navigation-header';
    header.append(this.tabs, this.pinButton, this.closeButton);

    this.input.type = 'search';
    this.input.placeholder = 'Find in document';
    this.input.setAttribute('aria-label', 'Find in document');
    this.input.setAttribute('aria-controls', `${this.panelId}-results`);
    this.input.oninput = () => {
      this.query = this.input.value;
      this.page = 0;
      this.cursor = -1;
      this.scheduleSearch();
    };
    this.input.onkeydown = event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.next(event.shiftKey ? -1 : 1);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.results.querySelector<HTMLButtonElement>('.navigation-result')?.focus();
      }
    };
    this.findRow.className = 'navigation-find';
    this.findRow.append(this.input, shortcutHint('find'));

    this.summary.className = 'navigation-summary';
    this.summary.setAttribute('role', 'status');
    this.summary.setAttribute('aria-live', 'polite');
    this.summary.id = `${this.panelId}-summary`;
    this.results.className = 'navigation-results';
    this.results.id = `${this.panelId}-results`;
    this.results.setAttribute('role', 'group');
    this.results.setAttribute('aria-label', 'Navigation results');
    this.results.setAttribute('tabindex', '-1');
    this.results.setAttribute('aria-labelledby', this.summary.id);
    this.results.addEventListener('keydown', event => this.handleResultsKeydown(event));
    this.results.addEventListener('scroll', () => {
      // Panel-local scrolling must never move the document.
      if (this.results.scrollHeight <= this.results.clientHeight) this.results.scrollTop = 0;
    }, {passive: true});
    this.pagination.className = 'navigation-pagination';
    this.element.append(header, this.findRow, this.summary, this.results, this.pagination);
    document.body.append(this.element);
    this.updatePin();
    this.updateTabs();

    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || this.element.hidden || this.pinned) return;
      if (document.querySelector('dialog[open]')) return;
      event.preventDefault();
      this.close({restoreFocus: true});
    });
    document.addEventListener('pointerdown', event => {
      if (this.element.hidden || this.pinned) return;
      const target = event.target as Node;
      if (this.element.contains(target) || this.options.isTrigger?.(target) || (target instanceof Element && target.closest('[data-navigation-trigger]'))) return;
      this.close({restoreFocus: false});
    });
    window.addEventListener('scroll', () => this.scheduleCurrentUpdate(), {passive: true});
    window.addEventListener('resize', () => this.scheduleCurrentUpdate());
  }

  get isPinned() { return this.pinned; }
  get currentMode() { return this.mode; }
  get isOpen() { return !this.element.hidden; }

  setPreferences(state: NavigationPreferenceState) {
    let changed = false;
    if (typeof state.pinned === 'boolean' && state.pinned !== this.pinned) {
      this.pinned = state.pinned;
      changed = true;
    }
    if ((state.mode === 'find' || state.mode === 'outline') && state.mode !== this.mode) {
      this.mode = state.mode;
      changed = true;
    }
    if (changed) {
      this.updatePin();
      this.updateTabs();
      this.findRow.hidden = this.mode !== 'find';
      if (!this.element.hidden) this.search();
    }
    // A pinned navigation is part of the document workspace; restore it when
    // the webview reloads without stealing focus from the editor.
    if (this.pinned && this.element.hidden) this.show(this.mode, undefined, false);
  }

  reset() {
    this.entries.clear();
    this.headingIds = [];
    this.headingOrders = [];
    this.headingRanks.clear();
    this.currentId = undefined;
    this.query = '';
    this.input.value = '';
    this.matches = [];
    this.cursor = -1;
    this.page = 0;
    this.scheduleRefresh();
  }

  remove(id: string) {
    this.entries.delete(id);
    this.scheduleRefresh();
  }

  reorder(ids: string[]) {
    const order = new Map(ids.map((id, index) => [id, index]));
    for (const [id, entry] of this.entries) entry.order = order.get(id) ?? entry.order;
    this.scheduleRefresh();
  }

  add(segments: Segment[]) {
    for (const segment of segments) this.index(segment, false);
    this.scheduleRefresh();
  }

  index(segment: Segment, schedule = true) {
    const heading = /^ {0,3}(#{1,6})\s+(.+?)(?:\s+#+)?\s*(?:\r?\n|$)/.exec(segment.text);
    const setext = !heading ? /^([^\r\n]+)\r?\n {0,3}(=+|-+)\s*(?:\r?\n|$)/.exec(segment.text) : null;
    const level = heading ? heading[1].length : setext ? (setext[2][0] === '=' ? 1 : 2) : 0;
    this.entries.set(segment.id, {
      segment,
      order: this.entries.get(segment.id)?.order ?? this.entries.size,
      text: segment.text.toLocaleLowerCase(),
      heading: heading?.[2]?.trim() ?? setext?.[1]?.trim(),
      level,
    });
    if (schedule) this.scheduleRefresh();
  }

  show(mode: NavigationMode = this.mode, opener?: HTMLElement, focus = true) {
    if (this.element.hidden) {
      this.lastOpener = opener;
      if (opener) this.lastFocus = opener;
      else this.captureFocus();
    }
    this.mode = mode;
    this.updateTabs();
    this.findRow.hidden = mode !== 'find';
    this.element.hidden = false;
    document.body.classList.add('navigation-open');
    this.options.onVisibilityChange?.(true);
    this.page = 0;
    this.cursor = -1;
    this.rebuildHeadingIndex();
    if (mode === 'outline' && this.currentId) {
      const rank = this.headingRanks.get(this.currentId);
      if (rank !== undefined) this.page = Math.floor(rank / PAGE_SIZE);
    }
    this.search();
    if (focus) {
      requestAnimationFrame(() => {
        if (mode === 'find') {
          this.input.focus();
        } else {
          this.updateCurrentHeading();
          this.results.focus();
        }
      });
    }
    this.options.onPreferenceChange?.({mode});
  }

  /** Open without toggling (used by commands) and keep an existing panel. */
  open(mode: NavigationMode, opener?: HTMLElement) {
    if (this.element.hidden) this.show(mode, opener);
    else this.activateMode(mode);
  }

  toggle(mode?: NavigationMode, opener?: HTMLElement) {
    if (this.element.hidden) {
      this.show(mode ?? this.mode, opener);
      return;
    }
    if (mode && mode !== this.mode) {
      this.activateMode(mode);
      return;
    }
    if (this.pinned) {
      this.focusInput();
      return;
    }
    this.close({restoreFocus: true});
  }

  close({restoreFocus = true, force = false} = {}) {
    if (this.pinned && !force) return;
    if (this.element.hidden) return;
    this.element.hidden = true;
    document.body.classList.remove('navigation-open');
    this.options.onVisibilityChange?.(false);
    clearTimeout(this.currentTimer);
    this.lastOpener = undefined;
    if (restoreFocus) this.restoreFocus();
    else this.lastFocus = undefined;
  }

  togglePinned() {
    this.pinned = !this.pinned;
    this.updatePin();
    this.options.onPreferenceChange?.({pinned: this.pinned});
  }

  setCurrent(id: string | undefined) {
    const changed = id !== this.currentId;
    this.currentId = id;
    // Repaint even when the heading did not change: reopening the panel resets
    // pagination, so the current row may now live on another page.
    if (this.mode === 'outline') this.updateCurrentPage();
    if (changed) this.paintCurrent();
    if (this.mode === 'outline') this.ensureCurrentVisible();
  }

  focusInput() {
    if (this.element.hidden) return;
    if (this.mode === 'find') this.input.focus();
    else this.results.focus();
  }

  private configureTab(button: HTMLButtonElement, label: string, mode: NavigationMode) {
    button.type = 'button';
    button.textContent = label;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', `${this.panelId}-results`);
    button.onclick = () => this.activateMode(mode);
    button.onkeydown = event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const nextMode = event.key === 'Home' ? 'find' : event.key === 'End' ? 'outline' : mode === 'find' ? 'outline' : 'find';
      this.activateMode(nextMode);
    };
  }

  private activateMode(mode: NavigationMode) {
    if (this.mode !== mode) {
      this.mode = mode;
      this.page = 0;
      this.cursor = -1;
      this.updateTabs();
      this.findRow.hidden = mode !== 'find';
      this.search();
      this.options.onPreferenceChange?.({mode});
    }
    if (mode === 'find') {
      this.input.focus();
    } else {
      this.updateCurrentHeading();
      this.results.focus();
    }
  }

  private updateTabs() {
    this.findTab.setAttribute('aria-selected', String(this.mode === 'find'));
    this.outlineTab.setAttribute('aria-selected', String(this.mode === 'outline'));
    this.findTab.tabIndex = this.mode === 'find' ? 0 : -1;
    this.outlineTab.tabIndex = this.mode === 'outline' ? 0 : -1;
    this.tabs.setAttribute('aria-label', `Navigation mode: ${this.mode}`);
  }

  private updatePin() {
    const shortcut = shortcutLabel('pinNavigation');
    this.pinButton.setAttribute('aria-label', `${this.pinned ? 'Unpin' : 'Pin'} navigation (${shortcut})`);
    this.pinButton.setAttribute('aria-keyshortcuts', shortcutAria('pinNavigation'));
    this.pinButton.setAttribute('aria-pressed', String(this.pinned));
    this.pinButton.textContent = this.pinned ? 'Pinned' : 'Pin';
    this.pinButton.title = `${this.pinned ? 'Unpin' : 'Pin'} navigation (${shortcut})`;
    this.element.dataset.pinned = String(this.pinned);
  }

  private captureFocus() {
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && focused !== document.body && !this.element.contains(focused)) {
      this.lastFocus = focused;
    }
  }

  private restoreFocus() {
    const editor = this.options.getEditorTarget();
    const candidates = [this.lastFocus, this.lastOpener].filter((item): item is HTMLElement => !!item);
    const target = (editor && isVisible(editor) ? editor : undefined)
      ?? candidates.find(item => item.isConnected && isVisible(item));
    this.lastFocus = undefined;
    target?.focus({preventScroll: true});
  }

  private scheduleRefresh() {
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.rebuildHeadingIndex();
      if (!this.element.hidden) {
        this.search();
        if (this.mode === 'outline') this.scheduleCurrentUpdate();
      }
    }, 40);
  }

  private rebuildHeadingIndex() {
    const headings = [...this.entries.values()]
      .filter(entry => !!entry.heading)
      .sort((a, b) => a.order - b.order);
    this.headingIds = headings.map(entry => entry.segment.id);
    this.headingOrders = headings.map(entry => entry.order);
    this.headingRanks.clear();
    this.headingIds.forEach((id, index) => this.headingRanks.set(id, index));
    if (this.currentId && !this.entries.has(this.currentId)) this.currentId = undefined;
  }

  private scheduleSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.search(), 55);
  }

  private search() {
    clearTimeout(this.searchTimer);
    if (!this.element.hidden) {
      if (this.mode === 'outline') {
        this.matches = this.headingIds.flatMap(id => {
          const entry = this.entries.get(id);
          return entry ? [entry] : [];
        });
      } else {
        const query = this.query.trim().toLocaleLowerCase();
        this.matches = query ? [...this.entries.values()].filter(entry => entry.text.includes(query)) : [];
      }
    }
    this.page = clampNumber(this.page, 0, Math.max(0, Math.ceil(this.matches.length / PAGE_SIZE) - 1));
    this.cursor = this.matches.length ? Math.min(this.cursor, this.matches.length - 1) : -1;
    this.paint();
    if (this.mode === 'outline') this.scheduleCurrentUpdate();
  }

  private paint() {
    const pageCount = Math.max(1, Math.ceil(this.matches.length / PAGE_SIZE));
    this.page = clampNumber(this.page, 0, pageCount - 1);
    const start = this.page * PAGE_SIZE;
    const visible = this.matches.slice(start, start + PAGE_SIZE);
    this.results.replaceChildren(...visible.map((entry, index) => this.resultButton(entry, start + index)));
    if (!visible.length) {
      const empty = document.createElement('p');
      empty.className = 'navigation-empty';
      empty.textContent = this.mode === 'find' && !this.query.trim() ? 'Type to find text in this document.' : 'No results.';
      this.results.append(empty);
    }

    const first = this.matches.length ? start + 1 : 0;
    const last = Math.min(start + PAGE_SIZE, this.matches.length);
    if (this.mode === 'outline') {
      this.summary.textContent = `${this.matches.length} heading${this.matches.length === 1 ? '' : 's'}${this.matches.length > PAGE_SIZE ? ` · ${first}-${last}` : ''}`;
    } else {
      this.summary.textContent = this.query.trim()
        ? `${this.matches.length} match${this.matches.length === 1 ? '' : 'es'}${this.matches.length > PAGE_SIZE ? ` · ${first}-${last}` : ''}`
        : 'Type to find text in this document.';
    }
    this.paintPagination(pageCount);
    this.paintCurrent();
  }

  private resultButton(entry: Entry, index: number) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'navigation-result';
    if (entry.heading) button.dataset.level = String(entry.level);
    button.dataset.navigationId = entry.segment.id;
    button.dataset.index = String(index);
    const text = entry.heading || firstVisibleLine(entry.segment.text) || '(empty block)';
    button.textContent = text;
    button.title = text;
    button.setAttribute('aria-label', `${entry.heading ? `Heading ${entry.level}: ` : ''}${text}`);
    button.onclick = () => this.choose(entry, index);
    return button;
  }

  private paintPagination(pageCount: number) {
    this.pagination.replaceChildren();
    if (pageCount <= 1) {
      this.pagination.hidden = true;
      return;
    }
    this.pagination.hidden = false;
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.textContent = 'Previous';
    previous.setAttribute('aria-label', 'Previous page');
    previous.disabled = this.page === 0;
    previous.onclick = () => {
      this.page--;
      this.paint();
    };
    const next = document.createElement('button');
    next.type = 'button';
    next.textContent = 'Next';
    next.setAttribute('aria-label', 'Next page');
    next.disabled = this.page >= pageCount - 1;
    next.onclick = () => {
      this.page++;
      this.paint();
    };
    const status = document.createElement('span');
    status.textContent = `${this.page + 1} / ${pageCount}`;
    this.pagination.append(previous, status, next);
  }

  private choose(entry: Entry, index: number) {
    this.cursor = index;
    this.options.jump(entry.segment, this.query, true);
    if (this.mode === 'outline') this.setCurrent(entry.segment.id);
    this.paintCurrent();
    if (!this.pinned) this.close({restoreFocus: true});
  }

  private next(direction: 1 | -1) {
    if (!this.matches.length) return;
    if (this.cursor < 0) this.cursor = direction > 0 ? 0 : this.matches.length - 1;
    else this.cursor = (this.cursor + direction + this.matches.length) % this.matches.length;
    this.page = Math.floor(this.cursor / PAGE_SIZE);
    this.paint();
    const entry = this.matches[this.cursor];
    this.options.jump(entry.segment, this.query, true);
    if (this.mode === 'outline') this.setCurrent(entry.segment.id);
    this.results.querySelector<HTMLElement>(`[data-navigation-id=${cssEscape(entry.segment.id)}]`)?.focus();
  }

  private handleResultsKeydown(event: KeyboardEvent) {
    const items = [...this.results.querySelectorAll<HTMLButtonElement>('.navigation-result:not(:disabled)')];
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    let index: number;
    if (event.key === 'ArrowDown') index = (current + 1 + items.length) % items.length;
    else if (event.key === 'ArrowUp') index = (current - 1 + items.length) % items.length;
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = items.length - 1;
    else return;
    event.preventDefault();
    items[index]?.focus();
  }

  private scheduleCurrentUpdate() {
    if (this.element.hidden || this.mode !== 'outline') return;
    clearTimeout(this.currentTimer);
    this.currentTimer = setTimeout(() => this.updateCurrentHeading(), CURRENT_HEADING_DELAY);
  }

  /**
   * Pick the last heading whose top has passed the toolbar. Only mounted
   * segments are measured; the heading index fills the gap when a long
   * heading-free passage is on screen.
   */
  private updateCurrentHeading() {
    this.currentTimer = undefined;
    if (this.element.hidden || this.mode !== 'outline') return;
    if (!this.headingIds.length) {
      this.setCurrent(undefined);
      return;
    }
    const threshold = this.options.getToolbarBottom() + 4;
    const mounted = this.options.getDocumentRoot().querySelectorAll<HTMLElement>('.segment[data-id]');
    // The deepest mounted block above the toolbar tells us where the reader
    // is. A heading may not be in that chunk at all (long paragraphs), so the
    // binary search below resolves the nearest heading at or before it.
    let lastOrder = -1;
    for (const segment of mounted) {
      const id = segment.dataset.id;
      if (!id) continue;
      const entry = this.entries.get(id);
      if (!entry) continue;
      const top = (entry.heading ? headingElement(segment) : segment).getBoundingClientRect().top;
      if (top <= threshold && entry.order > lastOrder) lastOrder = entry.order;
    }
    if (lastOrder >= 0) {
      const rank = lastAtOrBefore(this.headingOrders, lastOrder);
      if (rank >= 0) {
        this.setCurrent(this.headingIds[rank]);
        return;
      }
    }
    this.setCurrent(this.headingIds[0]);
  }

  private paintCurrent() {
    const buttons = [...this.results.querySelectorAll<HTMLButtonElement>('[data-navigation-id]')];
    let activeId = this.mode === 'outline'
      ? this.currentId
      : this.cursor >= 0 ? this.matches[this.cursor]?.segment.id : undefined;
    if (!buttons.some(button => button.dataset.navigationId === activeId)) {
      activeId = buttons[0]?.dataset.navigationId;
    }
    let marked = 0;
    for (const button of buttons) {
      const active = button.dataset.navigationId === activeId && marked === 0;
      if (active) {
        button.setAttribute('aria-current', 'location');
        button.classList.add('navigation-current');
        marked++;
      } else {
        button.removeAttribute('aria-current');
        button.classList.remove('navigation-current');
      }
    }
  }

  private updateCurrentPage() {
    if (this.mode !== 'outline' || !this.currentId) return;
    const rank = this.headingRanks.get(this.currentId);
    if (rank === undefined) return;
    const targetPage = Math.floor(rank / PAGE_SIZE);
    if (targetPage !== this.page) {
      this.page = targetPage;
      this.paint();
    }
  }

  private ensureCurrentVisible() {
    if (!this.isOpen || this.mode !== 'outline' || !this.currentId) return;
    const button = this.results.querySelector<HTMLElement>(`[data-navigation-id=${cssEscape(this.currentId)}]`);
    if (!button) return;
    const viewport = this.results.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    if (rect.top < viewport.top) this.results.scrollTop -= viewport.top - rect.top;
    else if (rect.bottom > viewport.bottom) this.results.scrollTop += rect.bottom - viewport.bottom;
  }
}

function headingElement(segment: HTMLElement) {
  return segment.querySelector<HTMLElement>('h1,h2,h3,h4,h5,h6') ?? segment;
}

function firstVisibleLine(text: string) {
  return text.split(/\r?\n/).map(line => line.trim()).find(Boolean) ?? '';
}

function isVisible(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden';
}

function clampNumber(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

/** Index of the last value <= target in a sorted numeric array. */
function lastAtOrBefore(values: number[], target: number) {
  let low = 0;
  let high = values.length - 1;
  let result = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (values[middle] <= target) {
      result = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return result;
}

function cssEscape(value: string) {
  return CSS.escape(value);
}

function shortcutHint(id: 'find') {
  const hint = document.createElement('kbd');
  hint.textContent = shortcutLabel(id);
  hint.setAttribute('aria-label', shortcutAria(id));
  return hint;
}
