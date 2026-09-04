import BaseReportTemplate from '../ui/BaseReportTemplate';
import {dateToDisplay} from '../../utils/dateInput';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Coins, Printer, Scale, AlertTriangle } from 'lucide-react';
import type { Account, CashBox, BankAccount, Employee, Customer, Vendor, Currency } from '../../types/erp';
import { useActiveCurrencies } from '../../hooks/useActiveCurrencies';
import { useExchangeRateGuard } from '../../hooks/useExchangeRateGuard';
import PageHeader from '../ui/PageHeader';
import { useToast } from '../ui/Toast';
import { fmtAmount, fmtAmountCur } from '../../utils/format';
import type { EntryLine, BrowseRow, RowState, SavePayload, RowEditField } from './opening/types';
import { zeroRow, localOf, round2, uid, SUB_LEDGER_KIND_LABEL, compositeKey, aggregateOpeningTotals } from './opening/types';
import OpeningBalancesToolbar from './opening/OpeningBalancesToolbar';
import OpeningBalancesGrid, { type GridLine } from './opening/OpeningBalancesGrid';
import ModalShell from '../ui/ModalShell';
import { useTabDirty } from '../../tabs/TabsContext';
import { selectPostingAccounts, buildLinkedEntities, buildOpeningBalancesPayload, type LinkedEntity } from '../../services/openingBalancesService';
import { loadBranchesLocal } from '../../utils/companyStore';
import { buildXlsx, downloadBlob, type XlsxSheet } from '../../utils/xlsxWriter';
import { handleCurrencyFieldChange } from '../../utils/currencyMath';
import AttachmentPicker from '../ui/AttachmentPicker';
import type { SupportingDocument } from '../../types/supportingDocuments';
import { openDesktopPrintPreview } from '../../utils/desktopPrintPreview';

interface Props {
  currentUserName?: string;
  accounts: Account[];
  cashBoxes: CashBox[];
  bankAccounts: BankAccount[];
  employees: Employee[];
  customers: Customer[];
  vendors: Vendor[];
  currencies?: Currency[];
  status: 'NONE' | 'DRAFT' | 'POSTED';
  onSaveDraft: (payload: SavePayload) => void;
  onPost: (payload: SavePayload) => void;
}

export default function OpeningBalancesView({ currentUserName = '—', accounts, cashBoxes, bankAccounts, employees, customers, vendors, currencies = [], status, onSaveDraft, onPost }: Props) {
  const toast = useToast();

  const [lines, setLines] = useState<EntryLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [attachments, setAttachments] = useState<SupportingDocument[]>([]);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isPostConfirmOpen, setIsPostConfirmOpen] = useState(false);
  const [incompleteBrowseKeys, setIncompleteBrowseKeys] = useState<string[]>([]);
  const [autoFocusKey, setAutoFocusKey] = useState<string | null>(null);
  // حالة تتبع السطور المحذوفة لضمان الاختفاء الفوري وتحديث المجاميع
  const [deletedKeys, setDeletedKeys] = useState<Set<string>>(new Set());
  const printablePaperRef = useRef<HTMLDivElement>(null);

  const setDirty = useTabDirty('OPENING_BALANCES');
  const savedLinesRef = useRef<EntryLine[]>([]);
  const hasUnsavedLines = useMemo(() => JSON.stringify(lines) !== JSON.stringify(savedLinesRef.current), [lines]);
  useEffect(() => {
    setDirty(hasUnsavedLines);
  }, [hasUnsavedLines, setDirty]);

  const { active: currencyOptions, baseCode: bagBaseCode, rateOf } = useActiveCurrencies(currencies);
  const baseCode = bagBaseCode || 'YER';
  const rateGuard = useExchangeRateGuard(currencies);

  const postingAccounts = useMemo(() => selectPostingAccounts(accounts), [accounts]);
  const accountById = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);

  const linked = useMemo(
    () => buildLinkedEntities({ accounts, cashBoxes, bankAccounts, customers, vendors, employees, baseCode }),
    [accounts, baseCode, cashBoxes, bankAccounts, customers, vendors, employees]
  );
  const controlAccountIds = useMemo(() => new Set(linked.map(l => l.linkedAccountId)), [linked]);
  const isControl = (accountId: string): boolean => controlAccountIds.has(accountId);

  /** المفاتيح المركبة المحفوظة فعلاً في قاعدة البيانات */
  const savedKeys = useMemo(() => {
    const set = new Set<string>();
    accounts.forEach(a => {
      if (a.openingBalances && a.openingBalances.length > 0) {
        a.openingBalances.forEach(rec => {
          if (rec.amount && rec.amount !== 0) {
            set.add(compositeKey(a.id, null, rec.currency));
          }
        });
      } else {
        if (a.openingBalance !== undefined && a.openingBalance !== 0) {
          set.add(compositeKey(a.id, null, a.defaultCurrency || baseCode));
        }
        if (a.openingBalanceForeign && a.openingBalanceForeign !== 0 && a.openingCurrency) {
          set.add(compositeKey(a.id, null, a.openingCurrency));
        }
      }
    });
    linked.forEach(e => {
      if (e.openingBalances && e.openingBalances.length > 0) {
        e.openingBalances.forEach(rec => {
          if (rec.amount && rec.amount !== 0) {
            set.add(compositeKey(e.linkedAccountId, e.id, rec.currency));
          }
        });
      } else {
        if (e.openingBalance) {
          set.add(compositeKey(e.linkedAccountId, e.id, e.openingCurrency || e.defaultCurrency));
        }
      }
    });
    return set;
  }, [accounts, linked, baseCode]);

  const initEntityRow = (cur: string, ob: number | undefined, obForeign: number | undefined, rate: number | undefined, docRef?: string, dueDate?: string): RowState => {
    const cc = cur || baseCode;
    const rr = rate && rate > 0 ? rate : rateOf(cc);
    const f = obForeign || 0;
    return {
      debit: ob && ob > 0 ? round2(ob) : 0,
      credit: ob && ob < 0 ? round2(Math.abs(ob)) : 0,
      debitForeign: f > 0 ? round2(f) : 0,
      creditForeign: f < 0 ? round2(Math.abs(f)) : 0,
      currency: cc,
      rate: rr,
      documentRef: docRef,
      dueDate,
    };
  };

  const parseNum = (v: string): number => {
    const n = Number(String(v).replace(/[,\s]/g, ''));
    return Number.isFinite(n) ? round2(n) : 0;
  };

  const patchLine = (key: string, patch: Partial<EntryLine>) =>
    setLines(prev => prev.map(l => (l.key === key ? { ...l, ...patch } : l)));

  const addLine = () => {
    const key = uid();
    setLines(prev => [...prev, { key, kind: 'manual', account: null, codeText: '', entity: null, row: zeroRow(baseCode, rateOf(baseCode) || 1) }]);
    setAutoFocusKey(key);
  };

  const handleAccountTyped = (key: string, text: string) => {
    const l = lines.find(x => x.key === key);
    if (!l) return;
    if (l.account) {
      if (text !== l.account.code) {
        patchLine(key, { account: null, entity: null, codeText: text, row: zeroRow(baseCode, rateOf(baseCode) || 1) });
      }
    } else {
      patchLine(key, { codeText: text });
    }
  };

  const handleAccountEnter = (key: string, text: string) => {
    const t = String(text || '').trim();
    if (!t) return;
    const current = lines.find(line => line.key === key);
    // Enter للتنقل فقط: لا تُعِد تهيئة السطر إذا كان الحساب نفسه محسومًا بالفعل.
    if (current?.account?.code === t) return;
    const hit = postingAccounts.find(a => a.code === t);
    if (hit) handleSelectAccount(key, hit);
    else toast('info', `لا يوجد حساب تشغيلي برقم "${t}" — اضغط F9 للاستعراض.`);
  };

  const handleSelectAccount = (key: string, account: Account) => {
    const current = lines.find(line => line.key === key);
    if (current?.account?.id === account.id) {
      patchLine(key, { codeText: account.code });
      return;
    }
    const ctrl = isControl(account.id);
    const currency = ctrl ? baseCode : pickAvailableCurrency(account, null, key);
    patchLine(key, {
      account,
      codeText: account.code,
      entity: null,
      row: ctrl ? zeroRow(baseCode, 1) : zeroRow(currency, rateOf(currency) || 1),
    });
  };

  const handleSelectEntity = (key: string, entity: LinkedEntity) => {
    const l = lines.find(x => x.key === key);
    if (!l || !l.account) return;
    // إعادة اختيار نفس الحساب التحليلي لا تمسح المبالغ أو الحقول اللاحقة.
    if (l.entity?.id === entity.id) return;
    if (l.kind === 'fetched') {
      const nextRow = initEntityRow(entity.openingCurrency || entity.defaultCurrency, entity.openingBalance, entity.openingBalanceForeign, entity.openingRate, entity.openingDocumentRef, entity.openingDueDate);
      patchLine(key, { entity, row: nextRow });
    } else {
      const rowCurrency = entity.defaultCurrency || l.row?.currency || baseCode;
      const appropriateRate = getCurrencyRate(rowCurrency) || 1;
      patchLine(key, { entity, row: zeroRow(rowCurrency, appropriateRate) });
    }
  };

  const setValue = (key: string, field: RowEditField, raw: string) => {
    const n = parseNum(raw);
    setLines(prev => prev.map(l => {
      if (l.key !== key) return l;
      const current = l.row;
      const base = { currency: current.currency, rate: current.rate, documentRef: current.documentRef, dueDate: current.dueDate };
      let next: RowState;
      switch (field) {
        case 'debit':
        case 'credit': {
          if (current.currency !== baseCode) {
            const foreignSide = field === 'debit' ? (current.debitForeign || 0) : (current.creditForeign || 0);
            let rate = current.rate;
            if (foreignSide > 0) {
              const nextState = handleCurrencyFieldChange('local', n, {
                foreignAmount: foreignSide,
                exchangeRate: current.rate,
                localAmount: field === 'debit' ? current.debit : current.credit,
              });
              rate = nextState.exchangeRate;
            }
            next = {
              ...base,
              debit: field === 'debit' ? n : (n > 0 ? 0 : current.debit),
              credit: field === 'credit' ? n : (n > 0 ? 0 : current.credit),
              debitForeign: current.debitForeign || 0,
              creditForeign: current.creditForeign || 0,
              rate,
            };
          } else {
            next = { ...base, debit: field === 'debit' ? n : (n > 0 ? 0 : current.debit), credit: field === 'credit' ? n : (n > 0 ? 0 : current.credit), debitForeign: 0, creditForeign: 0 };
          }
          break;
        }
        case 'debitForeign':
          next = { ...base, debitForeign: n, creditForeign: n > 0 ? 0 : current.creditForeign || 0, debit: current.debit || 0, credit: current.credit || 0 };
          break;
        case 'creditForeign':
          next = { ...base, creditForeign: n, debitForeign: n > 0 ? 0 : current.debitForeign || 0, debit: current.debit || 0, credit: current.credit || 0 };
          break;
        case 'rate':
          next = { ...base, rate: Math.max(n, 0.0001), debit: current.debit || 0, credit: current.credit || 0, debitForeign: current.debitForeign || 0, creditForeign: current.creditForeign || 0 };
          break;
      }
      return { ...l, row: next };
    }));
  };

  const getCurrencyRate = (code: string): number => rateOf(code);

  const isCurrencyUsedForAccount = (
    excludeKey: string,
    account: Account | null,
    entity: LinkedEntity | null,
    currency: string,
  ): boolean => {
    if (!account) return false;
    return usedCurrenciesFor(account, entity, excludeKey).has(currency);
  };

  const setCurrency = (key: string, code: string) => {
    const line = lines.find(l => l.key === key);
    if (!line?.account) return;

    if (isCurrencyUsedForAccount(key, line.account, line.entity, code)) {
      toast('error', `العملة (${code}) مسجلة مسبقاً لهذا الحساب/التحليلي — اختر عملة أخرى.`);
      return;
    }

    setLines(prev => prev.map(l => {
      if (l.key !== key) return l;
      const current = l.row;
      const newRate = getCurrencyRate(code) || 1;
      const foreignAmount = (code !== baseCode) ? {
        debitForeign: current.debitForeign || 0,
        creditForeign: current.creditForeign || 0,
        debit: 0,
        credit: 0,
      } : {
        debitForeign: 0,
        creditForeign: 0,
        debit: current.debit || 0,
        credit: current.credit || 0,
      };
      const newEditKey = compositeKey(l.account!.id, l.entity?.id || null, code);
      return { ...l, row: { ...foreignAmount, currency: code, rate: newRate, documentRef: current.documentRef, dueDate: current.dueDate }, editKey: newEditKey };
    }));
  };

  const setRowText = (key: string, field: 'documentRef' | 'dueDate', value: string) => {
    setLines(prev => prev.map(l => (l.key === key ? { ...l, row: { ...l.row, [field]: value } } : l)));
  };

  const clearLine = (key: string) => {
    const line = lines.find(item => item.key === key);
    if (line?.account && line.editKey) {
      const savedRow = browseRows.find(row => compositeKey(row.accountId, row.entity?.id || null, row.currency) === line.editKey);
      if (savedRow?.saved) {
        setDeletedKeys(prev => new Set(prev).add(line.editKey!));
        onSaveDraft(buildDeletePayload(savedRow));
      }
    }
    setLines(prev => prev.filter(l => l.key !== key));
    savedLinesRef.current = savedLinesRef.current.filter(l => l.key !== key);
  };

  const currencyOptionsForAccount = (acc: Account): string[] => {
    const codes = new Set<string>();
    if (acc.defaultCurrency) codes.add(acc.defaultCurrency);
    (acc.currencies || []).forEach(c => { if (c.isActive) codes.add(c.code); });
    codes.add(baseCode);
    return Array.from(codes);
  };

  const currencyOptionsForEntity = (): string[] => {
    const codes = new Set<string>(currencyOptions.map(c => c.code));
    codes.add(baseCode);
    return Array.from(codes);
  };

  const usedCurrenciesFor = (account: Account, entity: LinkedEntity | null, excludeKey: string, editKey?: string): ReadonlySet<string> => {
    const used = new Set<string>();
    const accountId = account.id;
    const entityId = entity?.id || null;
    if (entityId && entity) {
      const cur = entity.openingCurrency || entity.defaultCurrency;
      if (entity.openingBalance && editKey !== compositeKey(accountId, entityId, cur)) used.add(cur);
    } else if (!entityId) {
      const cur = account.defaultCurrency || baseCode;
      if (account.openingBalance !== undefined && account.openingBalance !== 0 && editKey !== compositeKey(accountId, null, cur)) used.add(cur);
    }
    lines.forEach(o => {
      if (o.key === excludeKey || !o.account) return;
      if (o.account.id !== accountId) return;
      if ((o.entity?.id || '') !== entityId) return;
      used.add(o.row.currency);
    });
    return used;
  };

  const pickAvailableCurrency = (account: Account, entity: LinkedEntity | null, excludeKey: string): string => {
    const used = usedCurrenciesFor(account, entity, excludeKey);
    const options = entity ? currencyOptionsForEntity() : currencyOptionsForAccount(account);
    const preferred = entity ? (entity.openingCurrency || entity.defaultCurrency || baseCode) : (account.defaultCurrency || baseCode);
    const ordered = [preferred, ...options.filter(c => c !== preferred)];
    return ordered.find(c => !used.has(c)) ?? preferred;
  };

  const usedCurrenciesForRow = (key: string): ReadonlySet<string> => {
    const l = lines.find(x => x.key === key);
    return l?.account ? usedCurrenciesFor(l.account, l.entity, key, l.editKey) : new Set<string>();
  };

  const gridLines = useMemo<GridLine[]>(() => {
    // حافظ على ترتيب الإدخال؛ إعادة فرز السطور أثناء Enter كانت تنقل التركيز إلى سجل آخر.
    return lines.map(l => ({
      key: l.key,
      codeText: l.codeText,
      account: l.account,
      entity: l.entity,
      isControl: l.account ? isControl(l.account.id) : false,
      row: l.account && (!isControl(l.account.id) || !!l.entity) ? l.row : null,
    }));
  }, [lines, controlAccountIds, baseCode]);

  const duplicateLineKeys = useMemo(() => {
    const count = new Map<string, number>();
    lines.forEach(l => {
      if (!l.account || (isControl(l.account.id) && !l.entity)) return;
      const k = compositeKey(l.account.id, l.entity?.id || null, l.row.currency);
      count.set(k, (count.get(k) || 0) + 1);
    });
    const dup = new Set<string>();
    lines.forEach(l => {
      if (!l.account || (isControl(l.account.id) && !l.entity)) return;
      const k = compositeKey(l.account.id, l.entity?.id || null, l.row.currency);
      if ((count.get(k) || 0) > 1) dup.add(l.key);
      if (l.editKey !== k && savedKeys.has(k)) dup.add(l.key);
    });
    return dup;
  }, [lines, savedKeys, controlAccountIds]);

  const totals = useMemo(
    () => aggregateOpeningTotals(gridLines, baseCode, rateOf),
    [gridLines, baseCode, rateOf]
  );

  const isBalanced = Math.abs(totals.totalDebit - totals.totalCredit) < 0.01;

  const allBalanced = useMemo(() => {
    const t = aggregateOpeningTotals(
      lines.map(l => ({ row: l.account && (!isControl(l.account.id) || l.entity) ? l.row : null })),
      baseCode,
      rateOf
    );
    return { debit: t.totalDebit, credit: t.totalCredit, balanced: Math.abs(t.variance) < 0.01 };
  }, [lines, baseCode, rateOf, controlAccountIds]);

  const accountsWithBalance = useMemo(
    () => gridLines.filter(l => l.row && round2(localOf(l.row, baseCode, rateOf).debit - localOf(l.row, baseCode, rateOf).credit) !== 0).length,
    [gridLines, baseCode, rateOf]
  );

  const rateBlocked = lines.some(l => {
    if (!l.account || (isControl(l.account.id) && !l.entity)) return false;
    const r = l.row;
    if (!r.currency || r.currency === baseCode) return false;
    return rateGuard.outOfBounds(Number(r.rate) || 0, r.currency);
  });

  const zeroLineKeys = useMemo(() => {
    const set = new Set<string>();
    lines.forEach(l => {
      if (!l.account) return;
      if ((isControl(l.account.id) && !l.entity)) return;
      const r = l.row;
      if (!r) return;
      const allZero = (r.debit || 0) === 0 && (r.credit || 0) === 0 && (r.debitForeign || 0) === 0 && (r.creditForeign || 0) === 0;
      if (allZero) set.add(l.key);
    });
    return set;
  }, [lines, controlAccountIds]);

  const hasZeroLines = zeroLineKeys.size > 0;
  const hasLines = lines.some(l => l.account);
  const canSaveDraft = !saving && hasLines && !rateBlocked && !hasZeroLines;
  const canPost = canSaveDraft && allBalanced.balanced && status !== 'POSTED';
  const isPosted = status === 'POSTED';

  const buildPayload = (sourceLines: EntryLine[] = lines): SavePayload => {
    const accountLines = sourceLines.filter(l => l.account && !isControl(l.account.id));
    const controlLines = sourceLines.filter(l => l.account && isControl(l.account.id) && l.entity);

    const subLedgerTotals: Record<string, RowState> = {};
    controlLines.forEach(l => {
      const t = subLedgerTotals[l.account!.id] || zeroRow(baseCode, 1);
      const local = localOf(l.row, baseCode, rateOf);
      subLedgerTotals[l.account!.id] = {
        debit: round2(t.debit + local.debit),
        credit: round2(t.credit + local.credit),
        debitForeign: round2(t.debitForeign + (l.row.debitForeign || 0)),
        creditForeign: round2(t.creditForeign + (l.row.creditForeign || 0)),
        currency: baseCode,
        rate: 1,
      };
    });

    const accounts = accountLines.map(l => {
      const local = localOf(l.row, baseCode, rateOf);
      const rate = l.row.rate > 0 ? l.row.rate : rateOf(l.row.currency);
      return {
        id: l.account!.id,
        rowId: l.key,
        openingBalance: round2(local.debit - local.credit),
        openingBalanceForeign: round2((l.row.debitForeign || 0) - (l.row.creditForeign || 0)),
        debit: l.row.debitForeign || 0,
        credit: l.row.creditForeign || 0,
        debitLocal: round2(local.debit),
        creditLocal: round2(local.credit),
        currency: l.row.currency,
        rate,
        documentRef: l.row.documentRef,
        dueDate: l.row.dueDate,
      };
    });

    const controlAccountIds = [...new Set(controlLines.map(l => l.account!.id))];
    const controlAccounts = controlAccountIds.map(id => accountById.get(id)!).filter(Boolean);

    const { subLedgers } = buildOpeningBalancesPayload({
      postingAccounts: controlAccounts,
      subLedgerEntities: controlLines.map(l => ({ kind: l.entity!.kind, id: l.entity!.id, linkedAccountId: l.account!.id, row: l.row, rowId: l.key })),
      baseCode,
      rateOf,
      rowOfAccount: (a) => subLedgerTotals[a.id] || zeroRow(baseCode, 1),
      subLedgerTotals,
      isControl,
    });

    return { accounts, subLedgers };
  };

  const findDuplicateLine = (): EntryLine | null => {
    const count = new Map<string, string[]>();
    lines.forEach(l => {
      if (!l.account || (isControl(l.account.id) && !l.entity)) return;
      const k = compositeKey(l.account.id, l.entity?.id || null, l.row.currency);
      const arr = count.get(k) || [];
      arr.push(l.key);
      count.set(k, arr);
    });
    const wsDup = lines.find(l => {
      if (!l.account) return false;
      const k = compositeKey(l.account.id, l.entity?.id || null, l.row.currency);
      return (count.get(k)?.length || 0) > 1;
    });
    if (wsDup) return wsDup;
    return lines.find(l => {
      if (!l.account || (isControl(l.account.id) && !l.entity)) return false;
      const k = compositeKey(l.account.id, l.entity?.id || null, l.row.currency);
      return l.editKey !== k && savedKeys.has(k);
    }) || null;
  };

  const guardCommon = (): boolean => {
    if (rateBlocked) {
      toast('error', 'توقف الحفظ — يوجد سعر تحويل خارج النطاق المسموح لعملته (راجع خانة سعر التحويل للأرصدة بالعملات الأجنبية).');
      return false;
    }
    if (hasZeroLines) {
      toast('error', 'لا يمكن حفظ أسطر بأرصدة صفرية. يرجى إدخال قيمة للحساب أو حذف السطر.');
      return false;
    }
    const dup = findDuplicateLine();
    if (dup && dup.account) {
      toast('error', `⚠️ تنبيه: الحساب [${dup.account.nameAr}] للتحليلي [${dup.entity?.nameAr || 'لا يوجد'}] بعملة [${dup.row.currency}] مسجل مسبقاً! يُمنع تكرار نفس الحساب التحليلي لنفس العملة — عدّل السطر المكرر أو استخدم «استعراض الأرصدة المدخلة» لتعديل الرصيد الموجود بدلاً من تكراره.`);
      return false;
    }
    return true;
  };

  const stampEditKeys = (sourceLines: EntryLine[] = lines): EntryLine[] => {
    const stamped = sourceLines.map(l => l.account ? { ...l, editKey: compositeKey(l.account.id, l.entity?.id || null, l.row.currency) } : l);
    setLines(stamped);
    savedLinesRef.current = stamped;
    return stamped;
  };

  const handleSaveDraft = () => {
    if (!guardCommon()) return;
    const payload = buildPayload();
    const zeroCount = payload.accounts.filter(a => a.openingBalance === 0).length;
    setSaving(true);
    try {
    onSaveDraft({ ...payload, attachments });
      stampEditKeys();
      toast('success', `تم حفظ المسودة — ${payload.accounts.length} حساب${payload.subLedgers.length ? ` و ${payload.subLedgers.length} كيان تحليلي` : ''} (يمكنك العودة للتعديل لاحقاً)${zeroCount ? ` — تصفير ${zeroCount} رصيد محذوف/فارغ.` : ''}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePostClick = () => {
    if (!guardCommon()) return;
    if (!allBalanced.balanced) {
      toast('error', 'لا يمكن الترحيل — الأرصدة غير متوازنة. يجب أن يساوي إجمالي المدين إجمالي الدائن.');
      return;
    }
    setIsPostConfirmOpen(true);
  };

  const handleConfirmPost = () => {
    setIsPostConfirmOpen(false);
    const payload = buildPayload();
    const zeroCount = payload.accounts.filter(a => a.openingBalance === 0).length;
    setSaving(true);
    try {
    onPost({ ...payload, attachments });
      stampEditKeys();
      toast('success', `تم ترحيل الأرصدة الافتتاحية بنجاح — ${payload.accounts.length} حساب${payload.subLedgers.length ? ` و ${payload.subLedgers.length} كيان تحليلي` : ''}${zeroCount ? ` — تصفير ${zeroCount} رصيد محذوف/فارغ.` : ''}`);
    } finally {
      setSaving(false);
    }
  };

  const browseRows = useMemo<BrowseRow[]>(() => {
    const out: BrowseRow[] = [];
    const seen = new Set<string>();

    lines.forEach(l => {
      if (!l.account) return;
      const hasAmount = (l.row.debit || 0) !== 0 || (l.row.credit || 0) !== 0 || (l.row.debitForeign || 0) !== 0 || (l.row.creditForeign || 0) !== 0;
      if (!hasAmount) return;
      const key = compositeKey(l.account.id, l.entity?.id || null, l.row.currency);
      if (seen.has(key) || deletedKeys.has(key)) return;
      seen.add(key);
      const local = localOf(l.row, baseCode, rateOf);
      const freshEntity = l.entity ? linked.find(e => e.id === l.entity!.id) : null;
      out.push({
        key: l.key,
        kind: l.entity ? 'subLedger' : 'account',
        accountId: l.account.id,
        accountCode: l.account.code,
        accountName: l.account.nameAr,
        entity: l.entity,
        currency: l.row.currency,
        rate: l.row.rate > 0 ? l.row.rate : rateOf(l.row.currency),
        debit: local.debit,
        credit: local.credit,
        debitForeign: l.row.debitForeign || 0,
        creditForeign: l.row.creditForeign || 0,
        documentRef: l.row.documentRef,
        dueDate: l.row.dueDate,
        saved: l.entity
          ? !!freshEntity?.openingBalance
          : (accountById.get(l.account.id)?.openingBalance !== undefined && accountById.get(l.account.id)?.openingBalance !== 0),
        onWorksheet: true,
      });
    });

    selectPostingAccounts(accounts).forEach(a => {
      if (isControl(a.id)) return;
      const records = a.openingBalances && a.openingBalances.length > 0
        ? a.openingBalances
        : [
          ...(a.openingBalance ? [{ currency: a.defaultCurrency || baseCode, amount: a.openingBalance, foreignAmount: a.openingBalanceForeign, rate: a.openingRate, documentRef: a.openingDocumentRef, dueDate: a.openingDueDate }] : []),
          ...(a.openingBalanceForeign && a.openingCurrency ? [{ currency: a.openingCurrency, amount: a.openingBalanceForeign, foreignAmount: a.openingBalanceForeign, rate: a.openingRate, documentRef: a.openingDocumentRef, dueDate: a.openingDueDate }] : []),
        ];
      records.forEach(rec => {
        if (!rec.amount || rec.amount === 0) return;
        const k = compositeKey(a.id, null, rec.currency);
        if (seen.has(k) || deletedKeys.has(k)) return;
        seen.add(k);
        const ob = rec.amount;
        const fob = rec.foreignAmount || 0;
        out.push({
          key: rec.id || `saved:${k}`,
          recordId: rec.id,
          kind: 'account',
          accountId: a.id,
          accountCode: a.code,
          accountName: a.nameAr,
          entity: null,
          currency: rec.currency,
          rate: rec.rate && rec.rate > 0 ? rec.rate : rateOf(rec.currency),
          debit: ob > 0 ? round2(ob) : 0,
          credit: ob < 0 ? round2(Math.abs(ob)) : 0,
          debitForeign: fob > 0 ? round2(fob) : 0,
          creditForeign: fob < 0 ? round2(Math.abs(fob)) : 0,
          documentRef: rec.documentRef,
          dueDate: rec.dueDate,
          saved: true,
          onWorksheet: false,
        });
      });
    });

    linked.forEach(ent => {
      const records = ent.openingBalances && ent.openingBalances.length > 0
        ? ent.openingBalances
        : [
          ...(ent.openingBalance ? [{ currency: ent.openingCurrency || ent.defaultCurrency, amount: ent.openingBalance, foreignAmount: ent.openingBalanceForeign, rate: ent.openingRate, documentRef: ent.openingDocumentRef, dueDate: ent.openingDueDate }] : []),
          ...(ent.openingBalanceForeign && ent.openingCurrency ? [{ currency: ent.openingCurrency, amount: ent.openingBalanceForeign, foreignAmount: ent.openingBalanceForeign, rate: ent.openingRate, documentRef: ent.openingDocumentRef, dueDate: ent.openingDueDate }] : []),
        ];
      records.forEach(rec => {
        if (!rec.amount || rec.amount === 0) return;
        const k = compositeKey(ent.linkedAccountId, ent.id, rec.currency);
        if (seen.has(k) || deletedKeys.has(k)) return;
        seen.add(k);
        const ob = rec.amount;
        const fob = rec.foreignAmount || 0;
        const acc = accountById.get(ent.linkedAccountId);
        out.push({
          key: rec.id || `saved:${k}`,
          recordId: rec.id,
          kind: 'subLedger',
          accountId: ent.linkedAccountId,
          accountCode: acc?.code || '',
          accountName: acc?.nameAr || '',
          entity: ent,
          currency: rec.currency,
          rate: rec.rate && rec.rate > 0 ? rec.rate : rateOf(rec.currency),
          debit: ob > 0 ? round2(ob) : 0,
          credit: ob < 0 ? round2(Math.abs(ob)) : 0,
          debitForeign: fob > 0 ? round2(fob) : 0,
          creditForeign: fob < 0 ? round2(Math.abs(fob)) : 0,
          documentRef: rec.documentRef,
          dueDate: rec.dueDate,
          saved: true,
          onWorksheet: false,
        });
      });
    });

    return out.sort((x, y) => x.accountCode.localeCompare(y.accountCode, 'en', { numeric: true }));
  }, [lines, accounts, linked, accountById, baseCode, rateOf, controlAccountIds, deletedKeys]);

  const savedRows = useMemo<BrowseRow[]>(() => browseRows.filter(r => r.saved && !r.onWorksheet), [browseRows]);

  const browseTotals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    browseRows.forEach(r => {
      debit += r.debit;
      credit += r.credit;
    });
    return { debit: round2(debit), credit: round2(credit) };
  }, [browseRows]);
  const browseBalanced = Math.abs(browseTotals.debit - browseTotals.credit) < 0.01;

  const buildDeletePayload = (row: BrowseRow): SavePayload => {
    if (row.kind === 'account') {
      return {
        accounts: [{ id: row.accountId, rowId: row.recordId || crypto.randomUUID(), openingBalance: 0, openingBalanceForeign: 0, debit: 0, credit: 0, debitLocal: 0, creditLocal: 0, currency: row.currency, rate: row.rate }],
        subLedgers: [],
      };
    }
    const others = linked.filter(e => e.linkedAccountId === row.accountId && e.id !== row.entity?.id);
    const remaining = others.reduce((s, e) => {
      if (e.openingBalances && e.openingBalances.length > 0) {
        return s + e.openingBalances.reduce((sum, r) => sum + (r.amount || 0), 0);
      }
      return s + (e.openingBalance || 0);
    }, 0);
    const remainingForeign = others.reduce((s, e) => {
      if (e.openingBalances && e.openingBalances.length > 0) {
        return s + e.openingBalances.reduce((sum, r) => sum + (r.foreignAmount || 0), 0);
      }
      return s + (e.openingBalanceForeign || 0);
    }, 0);
    const ent = row.entity!;
    return {
      accounts: [{
        id: row.accountId,
        rowId: crypto.randomUUID(),
        openingBalance: round2(remaining),
        openingBalanceForeign: round2(remainingForeign),
        debit: 0,
        credit: 0,
        debitLocal: round2(remaining),
        creditLocal: 0,
        currency: baseCode,
        rate: 1,
      }],
      subLedgers: [{
        kind: ent.kind,
        id: ent.id,
        rowId: row.recordId || crypto.randomUUID(),
        linkedAccountId: row.accountId,
        openingBalance: 0,
        openingBalanceForeign: 0,
        debit: 0,
        credit: 0,
        debitLocal: 0,
        creditLocal: 0,
        currency: row.currency || ent.openingCurrency || ent.defaultCurrency,
        rate: row.rate || ent.openingRate || rateOf(row.currency || ent.openingCurrency || ent.defaultCurrency),
      }],
    };
  };

  const handleEditFromBrowse = (row: BrowseRow) => {
    const k = compositeKey(row.accountId, row.entity?.id || null, row.currency);
    setDeletedKeys(prev => {
      const next = new Set(prev);
      next.delete(k);
      return next;
    });

    const matchKey = lines.find(l => l.account && (
      row.kind === 'subLedger'
        ? l.account.id === row.accountId && l.entity?.id === row.entity?.id && l.row.currency === row.currency
        : l.account.id === row.accountId && l.row.currency === row.currency
    ))?.key;

    if (matchKey) {
      setAutoFocusKey(matchKey);
      return;
    }
    const acc = accountById.get(row.accountId);
    if (!acc) {
      toast('error', 'لم يتم العثور على الحساب المرتبط.');
      return;
    }
    const key = row.recordId || uid();
    const rr = row.rate > 0 ? row.rate : rateOf(row.currency);
    const isForeign = row.currency !== baseCode;
    const newRow: RowState = isForeign
      ? { debit: 0, credit: 0, debitForeign: row.debitForeign || 0, creditForeign: row.creditForeign || 0, currency: row.currency, rate: rr, documentRef: row.documentRef, dueDate: row.dueDate }
      : { debit: row.debit || 0, credit: row.credit || 0, debitForeign: 0, creditForeign: 0, currency: row.currency, rate: rr, documentRef: row.documentRef, dueDate: row.dueDate };
    const newLine: EntryLine = {
      key,
      kind: 'manual',
      account: acc,
      codeText: acc.code,
      entity: row.entity,
      row: newRow,
      editKey: k,
    };
    setLines(prev => [...prev, newLine]);
    setAutoFocusKey(key);
    toast('info', `تم تحميل رصيد ${acc.code} — ${acc.nameAr} إلى وضع التحرير.`);
  };

  const loadSavedIntoMainGrid = (sourceLines: EntryLine[]): EntryLine[] => {
    const newLines: EntryLine[] = [];
    let loaded = 0;
    let skipped = 0;

    savedRows.forEach(row => {
      const k = compositeKey(row.accountId, row.entity?.id || null, row.currency);
      const alreadyOnWorksheet = sourceLines.some(l => l.account && compositeKey(l.account.id, l.entity?.id || null, l.row.currency) === k);
      if (alreadyOnWorksheet) { skipped++; return; }

      const acc = accountById.get(row.accountId);
      if (!acc) return;

      const rr = row.rate > 0 ? row.rate : rateOf(row.currency);
      const isForeign = row.currency !== baseCode;
      const newRow: RowState = isForeign
        ? { debit: 0, credit: 0, debitForeign: row.debitForeign || 0, creditForeign: row.creditForeign || 0, currency: row.currency, rate: rr, documentRef: row.documentRef, dueDate: row.dueDate }
        : { debit: row.debit || 0, credit: row.credit || 0, debitForeign: 0, creditForeign: 0, currency: row.currency, rate: rr, documentRef: row.documentRef, dueDate: row.dueDate };

      newLines.push({
        key: row.recordId || uid(),
        kind: 'manual',
        account: acc,
        codeText: acc.code,
        entity: row.entity,
        row: newRow,
        editKey: k,
      });
      loaded++;
    });

    const merged = [...sourceLines, ...newLines];
    setLines(merged);
    savedLinesRef.current = merged;

    const parts = [];
    if (loaded > 0) parts.push(`تم تحميل ${loaded} رصيد`);
    if (skipped > 0) parts.push(`تم تخطي ${skipped} (موجود مسبقاً)`);
    toast(loaded > 0 ? 'success' : 'info', parts.length > 0 ? parts.join(' — ') : 'جميع الأرصدة موجودة بالفعل في جدول الإدخال الرئيسي.');
    return merged;
  };

  const isIncompleteBrowseLine = (line: EntryLine): boolean => {
    if (!line.account) return true;
    if (isControl(line.account.id) && !line.entity) return true;
    const row = line.row;
    return !row || ((row.debit || 0) === 0 && (row.credit || 0) === 0 && (row.debitForeign || 0) === 0 && (row.creditForeign || 0) === 0);
  };

  const autoSaveThenPopulateMainGrid = (sourceLines: EntryLine[]) => {
    const sourceRateBlocked = sourceLines.some(line => line.account && (!isControl(line.account.id) || line.entity)
      && line.row.currency !== baseCode && rateGuard.outOfBounds(Number(line.row.rate) || 0, line.row.currency));
    const sourceCompositeKeys = sourceLines
      .filter(line => line.account && (!isControl(line.account.id) || line.entity))
      .map(line => compositeKey(line.account!.id, line.entity?.id || null, line.row.currency));
    const sourceHasDuplicates = new Set(sourceCompositeKeys).size !== sourceCompositeKeys.length;
    if (sourceRateBlocked || sourceHasDuplicates) {
      toast('error', 'تعذر فتح الاستعراض: راجع أسعار التحويل والأسطر المكررة أولاً.');
      return;
    }
    if (status !== 'POSTED' && sourceLines.length > 0) {
      const payload = buildPayload(sourceLines);
      onSaveDraft({ ...payload, attachments });
      sourceLines = sourceLines.map(l => l.account ? { ...l, editKey: compositeKey(l.account.id, l.entity?.id || null, l.row.currency) } : l);
      toast('success', 'تم حفظ التغييرات تلقائياً قبل استعراض الأرصدة المدخلة.');
    }
    loadSavedIntoMainGrid(sourceLines);
  };

  const handleBrowseWithAutoSave = () => {
    const incomplete = lines.filter(isIncompleteBrowseLine).map(line => line.key);
    if (incomplete.length > 0) {
      setIncompleteBrowseKeys(incomplete);
      return;
    }
    autoSaveThenPopulateMainGrid(lines);
  };

  const discardIncompleteAndBrowse = () => {
    const keys = new Set(incompleteBrowseKeys);
    const completeLines = lines.filter(line => !keys.has(line.key));
    setIncompleteBrowseKeys([]);
    autoSaveThenPopulateMainGrid(completeLines);
  };

  const companyBranch = useMemo(() => loadBranchesLocal()[0], []);
  const formatPrintDate = (d?: string): string => (dateToDisplay(d || '') || '—');

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<Coins className="w-5 h-5" />}
        title="الأرصدة الافتتاحية"
        subtitle="إدخال أرصدة افتتاحية للحسابات والكيانات التحليلية"
        actions={
          <div className="flex items-center gap-2">
            {isPosted && (
              <span className="flex items-center gap-1.5 rounded-xl border border-sky-200 bg-white/95 px-3 py-2 text-sm font-bold text-sky-800 shadow-sm dark:border-sky-300/40 dark:bg-sky-950/60 dark:text-sky-100">
                مُرحَّل
              </span>
            )}
            {status === 'DRAFT' && (
              <span className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-950 shadow-sm dark:border-amber-300/40 dark:bg-amber-950/60 dark:text-amber-100">
                مسودة
              </span>
            )}
            <span className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-bold shadow-sm ${isBalanced
              ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-300/40 dark:bg-emerald-950/60 dark:text-emerald-100'
              : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-300/40 dark:bg-amber-950/60 dark:text-amber-100'}`}>
              {isBalanced ? <Scale className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              {isBalanced ? 'متوازن' : `غير متوازن (فرق ${fmtAmount(Math.abs(round2(totals.totalDebit - totals.totalCredit)))})`}
            </span>
          </div>
        }
      />

      <OpeningBalancesToolbar
        savedRows={savedRows}
        onPickSaved={handleEditFromBrowse}
        onLoadAll={handleBrowseWithAutoSave}
        onAddLine={addLine}
        canSaveDraft={canSaveDraft}
        canPost={canPost}
        isPosted={isPosted}
        saving={saving}
        onSaveDraft={handleSaveDraft}
        onPost={handlePostClick}
        onPrint={() => setIsPrintOpen(true)}
        onBrowse={handleBrowseWithAutoSave}
      />
      <AttachmentPicker documents={attachments} onChange={setAttachments} uploadedBy="current-user" documentType="OPENING_SUPPORT" />

      <OpeningBalancesGrid
        lines={gridLines}
        baseCode={baseCode}
        rateOf={rateOf}
        boundsOf={rateGuard.boundsOf}
        currencyOptionsForAccount={currencyOptionsForAccount}
        currencyOptionsForEntity={currencyOptionsForEntity}
        allAccountItems={postingAccounts}
        allEntities={linked}
        totalDebit={totals.debit}
        totalCredit={totals.credit}
        isBalanced={isBalanced}
        isPosted={isPosted}
        accountsWithBalance={accountsWithBalance}
        usedCurrenciesFor={usedCurrenciesForRow}
        isCurrencyUsedForAccount={(ek, aid, eid, c) => {
          const l = lines.find(x => x.key === ek);
          if (!l?.account) return false;
          return isCurrencyUsedForAccount(ek, l.account, l.entity, c);
        }}
        duplicateLineKeys={duplicateLineKeys}
        zeroLineKeys={zeroLineKeys}
        autoFocusKey={autoFocusKey}
        onAutoFocusHandled={() => setAutoFocusKey(null)}
        onAddLine={addLine}
        onSelectAccount={handleSelectAccount}
        onSelectEntity={handleSelectEntity}
        onAccountTyped={handleAccountTyped}
        onAccountEnter={handleAccountEnter}
        onSetValue={setValue}
        onSetCurrency={setCurrency}
        onSetDocumentRef={(key, v) => setRowText(key, 'documentRef', v)}
        onSetDueDate={(key, v) => setRowText(key, 'dueDate', v)}
        onClearLine={clearLine}
        onEnterLastField={addLine}
      />

      <ModalShell
        id="opening-balances-incomplete-rows"
        open={incompleteBrowseKeys.length > 0}
        onClose={() => setIncompleteBrowseKeys([])}
        title="توجد سطور غير مكتملة"
        subtitle={`عدد السطور غير المكتملة: ${incompleteBrowseKeys.length}`}
        icon={AlertTriangle}
        size="sm"
        footer={null}
      >
        <div className="space-y-5 p-1 text-right">
          <p className="text-sm text-slate-300">يجب اختيار الحساب والحساب التحليلي عند الحاجة وإدخال قيمة غير صفرية. هل تريد تجاهل السطور غير المكتملة ثم حفظ الباقي تلقائياً؟</p>
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => setIncompleteBrowseKeys([])} className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-bold text-slate-200">إلغاء والعودة للإدخال</button>
            <button type="button" onClick={discardIncompleteAndBrowse} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-[#ffffff] hover:bg-red-500">تجاهل السطور غير المكتملة والمتابعة</button>
          </div>
        </div>
      </ModalShell>

      {isPrintOpen && (
        <ModalShell
          id="opening-balances-print"
          open={isPrintOpen}
          onClose={() => setIsPrintOpen(false)}
          title="معاينة تقرير الأرصدة الافتتاحية"
          icon={Printer}
          size="lg"
          maxWidth="max-w-3xl"
          footer={null}
          closeOnBackdrop={false}
          className="print-modal"
          bodyClassName="p-0"
          topRight={
            <button
              onClick={() => void openDesktopPrintPreview(printablePaperRef.current, 'الأرصدة الافتتاحية', 'portrait')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 text-white text-xs font-bold hover:bg-sky-400 transition-colors shadow-md cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              طباعة التقرير
            </button>
          }
        >
          <div ref={printablePaperRef} className="paper print-area bg-white text-slate-900 text-right overflow-y-auto" dir="rtl">
            <BaseReportTemplate reportTitleAr="تقرير الأرصدة الافتتاحية" reportTitleEn="Opening Balances Report" company={companyBranch || undefined} currentUserName={currentUserName}>
              <table className="w-full border border-slate-300">
                <colgroup>
                  <col style={{ width: '4%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '29%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '10%' }} />
                </colgroup>
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-black">
                    <th className="p-2 border-b border-slate-300">#</th>
                    <th className="p-2 border border-slate-300">رقم الحساب</th>
                    <th className="p-2 border border-slate-300">اسم الحساب</th>
                    <th className="p-2 border border-slate-300">العملة</th>
                    <th className="p-2 border border-slate-300">المدين المحلي</th>
                    <th className="p-2 border border-slate-300">الدائن المحلي</th>
                    <th className="p-2 border border-slate-300">الصافي</th>

                    <th className="p-2 border border-slate-300">الاستحقاق</th>
                  </tr>
                </thead>
                <tbody>
                  {browseRows.length === 0 ? (
                    <tr><td colSpan={8} className="p-8 text-center text-slate-500">لا توجد أرصدة افتتاحية مسجلة.</td></tr>
                  ) : browseRows.map((row, idx) => {
                    const net = round2(row.debit - row.credit);
                    return (
                      <tr key={row.key} className={idx % 2 ? 'bg-slate-50' : ''}>
                        <td className="p-2 text-center">{idx + 1}</td>
                        <td className="p-2 font-mono">{row.accountCode}</td>
                        <td className="p-2">{row.entity?.nameAr || row.accountName}</td>
                        <td className="p-2 font-mono">{row.currency}</td>
                        <td className="p-2 font-mono text-left text-emerald-700 font-bold">{row.debit > 0 ? fmtAmount(row.debit) : '—'}</td>
                        <td className="p-2 font-mono text-left text-amber-700 font-bold">{row.credit > 0 ? fmtAmount(row.credit) : '—'}</td>
                        <td className="p-2 font-mono text-left">{net === 0 ? '—' : (
                          <span className="inline-flex w-full items-center justify-between gap-1" dir="rtl">
                            <span>{net > 0 ? 'مدين' : 'دائن'}</span>
                            <span dir="ltr">{fmtAmount(Math.abs(net))}</span>
                          </span>
                        )}</td>

                        <td className="p-2">{formatPrintDate(row.dueDate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-black">
                    <td className="p-2 text-center" colSpan={4}>الإجمالي</td>
                    <td className="p-2 font-mono text-left text-emerald-800">{fmtAmount(browseTotals.debit)}</td>
                    <td className="p-2 font-mono text-left text-amber-800">{fmtAmount(browseTotals.credit)}</td>
                    <td className="p-2 font-mono" colSpan={2}>
                      {browseBalanced ? 'متوازن' : (
                        <span className="inline-flex w-full items-center justify-between gap-1" dir="rtl">
                          <span>الفرق:</span>
                          <span dir="ltr">{fmtAmount(Math.abs(round2(browseTotals.debit - browseTotals.credit)))}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>

            </BaseReportTemplate>
          </div>
        </ModalShell>
      )}

      {isPostConfirmOpen && (
        <ModalShell
          id="post-confirm-modal"
          open={isPostConfirmOpen}
          onClose={() => setIsPostConfirmOpen(false)}
          title="تأكيد ترحيل الأرصدة الافتتاحية"
          icon={AlertTriangle}
          size="sm"
          footer={
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPostConfirmOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmPost}
                className="px-4 py-2 text-xs font-black rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white border border-emerald-500 shadow-md transition-colors cursor-pointer"
              >
                تأكيد الترحيل
              </button>
            </div>
          }
        >
          <div className="p-5 space-y-3 text-sm text-slate-300">
            <p className="font-bold text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              تنبيه مهم
            </p>
            <p>هل أنت متأكد من ترحيل الأرصدة الافتتاحية إلى دفتر الأستاذ General Ledger؟</p>
            <p className="text-red-400 font-bold">لن يمكنك التعديل المباشر على الأرصدة بعد الترحيل.</p>
            <p className="text-slate-400 text-xs">يمكنك تعديل الأرصدة فقط عن طريق إعادة فتح السنة المالية من شاشة الإقفالات.</p>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
