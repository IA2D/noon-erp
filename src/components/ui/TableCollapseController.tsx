import { useEffect } from 'react';

const PRINT_ONLY_ANCESTORS = '[data-print-root],.report-page-template,.voucher-print-wrapper,.printable-report,.print-report-header';
const chevron = (expanded: boolean) => `<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${expanded ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6'}" /></svg>`;

/** Stable controller that remains functional when React replaces table sections. */
export default function TableCollapseController() {
  useEffect(() => {
    const state = new WeakMap<HTMLTableElement, boolean>();
    const setExpanded = (table: HTMLTableElement, expanded: boolean) => {
      state.set(table, expanded);
      const expandedText = String(expanded);
      if (table.dataset.tableExpanded !== expandedText) table.dataset.tableExpanded = expandedText;
      Array.from(table.tBodies).forEach(body => {
        if (body.hidden === expanded) body.hidden = !expanded;
      });
      if (table.tFoot && table.tFoot.hidden === expanded) table.tFoot.hidden = !expanded;
      const button = table.tHead?.querySelector<HTMLButtonElement>('.table-collapse-toggle');
      if (button) {
        const label = expanded ? 'طي الجدول' : 'توسيع الجدول';
        if (button.title !== label) button.title = label;
        if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
        if (button.getAttribute('aria-expanded') !== expandedText) {
          button.setAttribute('aria-expanded', expandedText);
          button.innerHTML = chevron(expanded);
        }
      }
    };
    const register = (table: HTMLTableElement) => {
      if (table.closest(PRINT_ONLY_ANCESTORS) || !table.tHead) return;
      table.dataset.collapsibleTable = 'true';
      if (!state.has(table)) state.set(table, table.dataset.tableExpanded !== 'false');
      const row = table.tHead.rows[0];
      if (!row?.cells.length) return;
      const ltr = table.dir === 'ltr' || getComputedStyle(table).direction === 'ltr';
      // Visual top-right: last DOM cell in LTR tables, first DOM cell in RTL tables.
      const anchor = ltr ? row.cells[row.cells.length - 1] : row.cells[0];
      table.tHead.querySelectorAll('.table-collapse-anchor').forEach(cell => cell.classList.remove('table-collapse-anchor'));
      anchor.classList.add('table-collapse-anchor');
      let button = table.tHead.querySelector<HTMLButtonElement>('.table-collapse-toggle');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'table-collapse-toggle no-print';
      }
      if (button.parentElement !== anchor) anchor.prepend(button);
      button.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        setExpanded(table, !(state.get(table) ?? true));
      };
      setExpanded(table, state.get(table) ?? true);
    };
    let frame = 0;
    const scan = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => document.querySelectorAll<HTMLTableElement>('table').forEach(register)); };
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    const collapsedBeforePrint = new Set<HTMLTableElement>();
    const beforePrint = () => document.querySelectorAll<HTMLTableElement>('table[data-collapsible-table="true"]').forEach(table => {
      if (!(state.get(table) ?? true)) collapsedBeforePrint.add(table);
      Array.from(table.tBodies).forEach(body => { body.hidden = false; });
      if (table.tFoot) table.tFoot.hidden = false;
    });
    const afterPrint = () => { collapsedBeforePrint.forEach(table => setExpanded(table, false)); collapsedBeforePrint.clear(); };
    window.addEventListener('beforeprint', beforePrint); window.addEventListener('afterprint', afterPrint);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('beforeprint', beforePrint); window.removeEventListener('afterprint', afterPrint); };
  }, []);
  return null;
}
