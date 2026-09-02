import { useEffect } from 'react';

const FIELD_SELECTOR = [
  'input:not([disabled]):not([readonly]):not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex="0"]:not(button):not(a):not(select):not(input):not(textarea)',
  '[data-enter-nav-field]:not([disabled])'
].join(',');

const ADD_LINE_RE = /(إضافة سطر|اضافة سطر|إضافة خط|اضافة خط|إضافة بند|اضافة بند|إضافة طرف|سطر جديد|خط جديد|بند جديد|add line|add row|add item)/i;

function isVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
  return true;
}

function collectFields(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FIELD_SELECTOR)).filter(isVisible);
}

/** حدود النطاق: أقرب حاوية مغلقة من الأعلى للأسفل (النوافذ المنبثقة تسبق النطاق الأوسع). */
function getBoundary(el: HTMLElement): ParentNode {
  let node: HTMLElement | null = el;
  while (node && node !== document.body) {
    if (node.matches('form, [data-enter-scope], [role="dialog"], [role="listbox"], [role="menu"], [role="combobox"]')) {
      return node;
    }
    if (window.getComputedStyle(node).position === 'fixed') {
      const rect = node.getBoundingClientRect();
      if (rect.width >= window.innerWidth * 0.6 || rect.height >= window.innerHeight * 0.6) {
        return node;
      }
    }
    node = node.parentElement;
  }
  return document;
}

function dataRowsWithin(root: ParentNode): HTMLElement[] {
  const table = (root as HTMLElement).tagName === 'TABLE' ? (root as HTMLElement) : null;
  const base = table
    ? Array.from(table.querySelectorAll<HTMLElement>('tr'))
    : Array.from(root.querySelectorAll<HTMLElement>('[data-enter-row]'));
  return base.filter(row => collectFields(row).length > 0);
}

function getGridContext(target: HTMLElement): { row: HTMLElement; rows: HTMLElement[]; fields: HTMLElement[] } | null {
  const row = target.closest<HTMLElement>('tr, [data-enter-row]');
  if (!row) return null;

  let rows: HTMLElement[];
  if (row.tagName === 'TR') {
    const table = row.closest<HTMLElement>('table');
    if (!table) return null;
    rows = dataRowsWithin(table);
  } else {
    const parent = row.parentElement;
    if (!parent) return null;
    rows = Array.from(parent.querySelectorAll<HTMLElement>('[data-enter-row]')).filter(r => collectFields(r).length > 0);
  }

  return { row, rows, fields: collectFields(row) };
}

function focusElement(el: HTMLElement): void {
  el.focus({ preventScroll: true });
}

function findAddRowButton(row: HTMLElement): HTMLButtonElement | null {
  const boundary = getBoundary(row) as ParentNode;
  const explicit = boundary.querySelector<HTMLButtonElement>('[data-enter-nav="add-line"]');
  if (explicit && !explicit.disabled) return explicit;

  const candidates = Array.from(boundary.querySelectorAll<HTMLButtonElement>('button[type="button"]'));
  return candidates.find(b => !b.disabled && ADD_LINE_RE.test(b.textContent ?? '')) ?? null;
}

function addNewRow(row: HTMLElement): boolean {
  const button = findAddRowButton(row);
  if (!button) return false;

  const isTable = row.tagName === 'TR';
  const table = isTable ? (row.closest<HTMLElement>('table') ?? undefined) : undefined;
  const parent = isTable ? undefined : (row.parentElement ?? undefined);

  button.click();

  window.setTimeout(() => {
    let rows: HTMLElement[] = [];
    if (table && table.isConnected) {
      rows = dataRowsWithin(table);
    } else if (parent && parent.isConnected) {
      rows = Array.from(parent.querySelectorAll<HTMLElement>('[data-enter-row]')).filter(r => collectFields(r).length > 0);
    }
    if (rows.length === 0) {
      const boundary = getBoundary(row) as ParentNode;
      rows = dataRowsWithin(boundary);
    }
    const last = rows[rows.length - 1];
    if (!last) return;
    const first = collectFields(last)[0];
    if (first) focusElement(first);
  }, 0);

  return true;
}

function move(dir: 1 | -1, target: HTMLElement): boolean {
  const grid = getGridContext(target);
  if (grid) {
    const { rows, fields } = grid;
    if (fields.length === 0) return false;
    const rowIndex = rows.indexOf(grid.row);
    const fieldIndex = fields.indexOf(target);

    if (dir === 1) {
      if (fieldIndex < fields.length - 1) {
        focusElement(fields[fieldIndex + 1]);
        return true;
      }
      const nextRow = rows[rowIndex + 1];
      if (nextRow) {
        const first = collectFields(nextRow)[0];
        if (first) {
          focusElement(first);
          return true;
        }
      }
      return addNewRow(grid.row);
    }

    if (fieldIndex > 0) {
      focusElement(fields[fieldIndex - 1]);
      return true;
    }
    if (rowIndex > 0) {
      const prevFields = collectFields(rows[rowIndex - 1]);
      const last = prevFields[prevFields.length - 1];
      if (last) {
        focusElement(last);
        return true;
      }
    }
    return false;
  }

  const boundary = getBoundary(target);
  const fields = collectFields(boundary);
  const index = fields.indexOf(target);
  if (index === -1) return false;
  for (let i = index + dir; dir === 1 ? i < fields.length : i >= 0; i += dir) {
    if (i === index) continue;
    const el = fields[i];
    if (isVisible(el)) {
      focusElement(el);
      return true;
    }
  }
  return false;
}

export function useEnterAsTab(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return;
      if (event.isComposing || event.keyCode === 229) return; // إدخال IME جارٍ
      if (event.repeat) return; // الضغط المستمر يُنشئ سطراً واحداً فقط
      if (event.defaultPrevented) return; // شاشة/مكوّن يدير Enter بنفسه

      const target = event.target as HTMLElement | null;
      if (!target || typeof target.tagName !== 'string') return;

      // استثناء: حقول النصوص المتعددة الأسطر تحتفظ بسلوك Enter الأصلي (سطر جديد)
      if (target.tagName === 'TEXTAREA') return;
      if (target.isContentEditable) return;

      const tag = target.tagName;
      const isFormButtonInput = tag === 'INPUT' && target.matches(
        'input[type="submit"], input[type="button"], input[type="reset"], input[type="image"]'
      );
      if (isFormButtonInput) return;

      const isInput = tag === 'INPUT';
      const isSelect = tag === 'SELECT';
      const isCustomCell = !isInput && !isSelect && (target.tabIndex >= 0) && !target.matches('button, a');
      if (!isInput && !isSelect && !isCustomCell) return;

      const dir: 1 | -1 = event.shiftKey ? -1 : 1;

      // checkbox/radio: نسمح لـ Enter بتبديل القيمة (كدالة Tab الأصلية) ثم ننتقل.
      const isToggle = tag === 'INPUT' && target.matches('input[type="checkbox"], input[type="radio"]');
      const deferMove = isSelect || isToggle;

      if (deferMove) {
        const targetEl = target;
        window.setTimeout(() => {
          move(dir, targetEl);
        }, 0);
        return; // لا preventDefault كي يُنفَّذ السلوك الأصلي (إغلاق القائمة / تبديل الاختيار)
      }

      const moved = move(dir, target);
      if (moved || isInput || isCustomCell) event.preventDefault();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}
