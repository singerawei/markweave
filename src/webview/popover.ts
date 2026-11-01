export interface PopoverOptions {
  onOpen?: () => void;
  /** Called after the menu closes. `reason` is 'action', 'escape' or 'outside'. */
  onClose?: (reason: 'action' | 'escape' | 'outside') => void;
  /** Element that receives focus on Escape; defaults to the trigger. */
  restoreFocus?: () => HTMLElement | undefined;
}

export function popover(trigger: HTMLElement, menu: HTMLElement, options: PopoverOptions | (() => void) = {}) {
  const settings: PopoverOptions = typeof options === 'function' ? {onOpen: options} : options;
  menu.hidden = true;
  menu.setAttribute('role', 'menu');
  if (!menu.id) menu.id = `menu-${Math.random().toString(36).slice(2)}`;
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-controls', menu.id);
  trigger.setAttribute('aria-expanded', 'false');

  const controller = new AbortController();
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    controller.abort();
    menu.remove();
  };
  const close = (reason: 'action' | 'escape' | 'outside' = 'action', restore = false) => {
    if (menu.hidden) return;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restore) (settings.restoreFocus?.() ?? trigger).focus();
    settings.onClose?.(reason);
    if (!trigger.isConnected) dispose();
  };
  const place = () => {
    const rect = trigger.getBoundingClientRect();
    const scale = parseFloat(getComputedStyle(document.body).zoom) || 1;
    const viewportWidth = innerWidth / scale;
    const viewportHeight = innerHeight / scale;
    const width = Math.min(280, viewportWidth - 16);
    menu.style.position = 'fixed';
    menu.style.width = `${width}px`;
    menu.hidden = false;
    const height = menu.getBoundingClientRect().height / scale;
    const triggerLeft = rect.left / scale;
    const triggerTop = rect.top / scale;
    const triggerBottom = rect.bottom / scale;
    const below = viewportHeight - triggerBottom - 8;
    const above = triggerTop - 8;
    const top = height <= below || below >= above ? triggerBottom + 4 : Math.max(8, triggerTop - height - 4);
    menu.style.left = `${Math.max(8, Math.min(triggerLeft, viewportWidth - width - 8))}px`;
    menu.style.top = `${top}px`;
    menu.style.maxHeight = `${Math.max(80, Math.min(viewportHeight - top - 8, viewportHeight - 16))}px`;
  };
  const open = () => {
    if ((trigger as HTMLButtonElement).disabled) return;
    settings.onOpen?.();
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    place();
    menu.querySelector<HTMLElement>('button:not(:disabled):not([hidden]),select:not(:disabled):not([hidden])')?.focus();
  };
  trigger.onclick = event => {
    event.stopPropagation();
    if (!menu.hidden) close('action', true);
    else open();
  };
  trigger.onkeydown = event => {
    if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    if (menu.hidden) open();
    const items = menuItems(menu);
    const index = event.key === 'ArrowUp' ? items.length - 1 : 0;
    items[index]?.focus();
  };
  menu.addEventListener('keydown', event => {
    const keyboard = event as KeyboardEvent;
    if (keyboard.key === 'Escape') {
      keyboard.preventDefault();
      keyboard.stopPropagation();
      close('escape', true);
      return;
    }
    const items = menuItems(menu);
    if (!items.length) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next: number;
    if (keyboard.key === 'ArrowDown') next = (index + 1 + items.length) % items.length;
    else if (keyboard.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
    else if (keyboard.key === 'Home') next = 0;
    else if (keyboard.key === 'End') next = items.length - 1;
    else return;
    keyboard.preventDefault();
    items[next]?.focus();
  });
  menu.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (button && !button.disabled) close('action');
  }, {signal: controller.signal});
  document.addEventListener('pointerdown', event => {
    if (!menu.contains(event.target as Node) && !trigger.contains(event.target as Node)) close('outside', false);
  }, {signal: controller.signal});
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) {
      event.preventDefault();
      event.stopPropagation();
      close('escape', true);
    }
  }, {signal: controller.signal});
  window.addEventListener('resize', () => { if (!menu.hidden) place(); }, {signal: controller.signal});
  return {close, place, open, dispose};
}

function menuItems(menu: HTMLElement) {
  return [...menu.querySelectorAll<HTMLElement>('button:not(:disabled):not([hidden]),select:not(:disabled):not([hidden])')]
    .filter(item => item.offsetParent !== null);
}
