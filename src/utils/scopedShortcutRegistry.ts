export interface ShortcutResolutionCandidate<T = symbol> {
  id: T;
  visible: boolean;
  focused: boolean;
}

/**
 * Resolves a shortcut without guessing between controls:
 * - a focused visible target wins;
 * - otherwise a shortcut works only when exactly one visible target exists;
 * - multiple focused/visible targets are treated as ambiguous.
 */
export const resolveScopedShortcutTarget = <T>(
  candidates: ShortcutResolutionCandidate<T>[],
): T | null => {
  const visible = candidates.filter(candidate => candidate.visible);
  const focused = visible.filter(candidate => candidate.focused);
  if (focused.length === 1) return focused[0].id;
  if (focused.length > 1) return null;
  return visible.length === 1 ? visible[0].id : null;
};

interface ShortcutRegistration {
  id: symbol;
  getElement: () => HTMLElement | null;
  run: (event: KeyboardEvent) => void;
  enabled: () => boolean;
}

const registrations = new Map<string, Map<symbol, ShortcutRegistration>>();
let listenerInstalled = false;

const normalizeKey = (key: string): string => key.toUpperCase();

const isVisible = (element: HTMLElement | null): element is HTMLElement => {
  if (!element?.isConnected) return false;
  if (element.hidden || element.closest('[hidden], [aria-hidden="true"]')) return false;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || element.getClientRects().length === 0) return false;

  // A control behind the currently raised modal is geometrically visible to the DOM,
  // but it is not an interactive shortcut target. Without this check, a page-level
  // F9 field can steal F9 from a locally handled account cell inside a foreground form.
  const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')]
    .filter(dialog => {
      const dialogStyle = window.getComputedStyle(dialog);
      return dialogStyle.display !== 'none'
        && dialogStyle.visibility !== 'hidden'
        && dialog.getClientRects().length > 0;
    });
  if (dialogs.length > 0) {
    const ownDialog = element.closest<HTMLElement>('[role="dialog"]');
    const topZ = Math.max(...dialogs.map(dialog => Number.parseInt(window.getComputedStyle(dialog).zIndex || '0', 10) || 0));
    if (!ownDialog) return false;
    const ownZ = Number.parseInt(window.getComputedStyle(ownDialog).zIndex || '0', 10) || 0;
    if (ownZ < topZ) return false;
  }

  return true;
};

const isEditable = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return target.matches('input, textarea, select, [contenteditable="true"]');
};

const handleShortcut = (event: KeyboardEvent) => {
  if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
  const group = registrations.get(normalizeKey(event.key));
  if (!group?.size) return;

  const activeElement = document.activeElement;
  const eligible = [...group.values()].filter(registration => registration.enabled());
  const resolution = eligible.map(registration => {
    const element = registration.getElement();
    return {
      id: registration.id,
      visible: isVisible(element),
      focused: Boolean(element && (element === activeElement || element.contains(activeElement))),
    };
  });
  const selectedId = resolveScopedShortcutTarget(resolution);
  if (!selectedId) return;

  const selected = group.get(selectedId);
  const selectedElement = selected?.getElement();
  const selectedIsFocused = Boolean(
    selectedElement && (selectedElement === activeElement || selectedElement.contains(activeElement)),
  );
  // Do not steal a function key from another editable control. A focused
  // registered control is still allowed, and a unique target works elsewhere.
  if (!selectedIsFocused && isEditable(event.target)) return;

  event.preventDefault();
  event.stopPropagation();
  selected?.run(event);
};

const ensureListener = () => {
  if (listenerInstalled || typeof document === 'undefined') return;
  document.addEventListener('keydown', handleShortcut, true);
  listenerInstalled = true;
};

const releaseListenerWhenIdle = () => {
  if (!listenerInstalled || registrations.size > 0 || typeof document === 'undefined') return;
  document.removeEventListener('keydown', handleShortcut, true);
  listenerInstalled = false;
};

export interface ScopedShortcutOptions {
  key: string;
  getElement: () => HTMLElement | null;
  run: (event: KeyboardEvent) => void;
  enabled?: () => boolean;
}

export const registerScopedShortcut = ({
  key,
  getElement,
  run,
  enabled = () => true,
}: ScopedShortcutOptions): (() => void) => {
  const normalizedKey = normalizeKey(key);
  const id = Symbol(normalizedKey);
  const group = registrations.get(normalizedKey) ?? new Map<symbol, ShortcutRegistration>();
  group.set(id, { id, getElement, run, enabled });
  registrations.set(normalizedKey, group);
  ensureListener();

  return () => {
    const currentGroup = registrations.get(normalizedKey);
    currentGroup?.delete(id);
    if (currentGroup?.size === 0) registrations.delete(normalizedKey);
    releaseListenerWhenIdle();
  };
};
