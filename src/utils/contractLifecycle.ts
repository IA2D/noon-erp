import type { ContractAction, ContractObligation, ContractVoucherLink, ERPContract } from '../types/contracts';

export interface ContractResult { ok: boolean; contract: ERPContract; errors: string[] }
const now = () => new Date().toISOString();
const action = (type: ContractAction['action'], actor: string, note: string): ContractAction => ({ id: `ca-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, action: type, actor, at: now(), note });
const result = (contract: ERPContract, errors: string[] = []): ContractResult => ({ ok: errors.length === 0, contract, errors });
const money = (value: number) => Math.round(value * 100) / 100;

export function validateContract(contract: ERPContract): string[] {
  const errors: string[] = [];
  if (!contract.contractNumber.trim()) errors.push('رقم العقد مطلوب.');
  if (!contract.title.trim()) errors.push('اسم العقد مطلوب.');
  if (!contract.partyId) errors.push('طرف العقد مطلوب.');
  if (!(contract.totalValue > 0)) errors.push('قيمة العقد يجب أن تكون أكبر من صفر.');
  if (!contract.startDate || !contract.endDate || contract.startDate > contract.endDate) errors.push('فترة العقد غير صحيحة.');
  if (!contract.currency || !(contract.exchangeRate > 0)) errors.push('عملة العقد أو سعر الصرف غير صالح.');
  if (!contract.milestones.length) errors.push('يجب إضافة استحقاق واحد على الأقل.');
  const milestoneTotal = money(contract.milestones.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  if (Math.abs(milestoneTotal - money(contract.totalValue)) > 0.01) errors.push('إجمالي الاستحقاقات لا يساوي قيمة العقد.');
  if (contract.milestones.some(item => !item.title.trim() || !item.dueDate || !(item.amount > 0))) errors.push('بيانات أحد الاستحقاقات غير مكتملة.');
  if (new Set(contract.milestones.map(item => item.id)).size !== contract.milestones.length) errors.push('معرفات الاستحقاقات مكررة.');
  return errors;
}

export function submitContract(contract: ERPContract, actor: string): ContractResult {
  const errors = [...validateContract(contract), ...(contract.status !== 'CREATED' && contract.status !== 'REJECTED' ? ['العقد ليس في حالة تسمح بالإرسال للمراجعة.'] : [])];
  if (errors.length) return result(contract, errors);
  return result({ ...contract, status: 'UNDER_REVIEW', updatedAt: now(), actions: [...contract.actions, action('SUBMIT', actor, 'إرسال العقد للمراجعة')] });
}

export function recordContractReview(contract: ERPContract, actor: string, note: string): ContractResult {
  const errors = contract.status !== 'UNDER_REVIEW' ? ['العقد ليس قيد المراجعة.'] : [];
  if (!note.trim()) errors.push('ملاحظة المراجعة مطلوبة.');
  if (errors.length) return result(contract, errors);
  return result({ ...contract, updatedAt: now(), actions: [...contract.actions, action('REVIEW', actor, note)] });
}

export function approveContract(contract: ERPContract, actor: string): ContractResult {
  const review = [...contract.actions].reverse().find(item => item.action === 'REVIEW');
  const errors = [...validateContract(contract)];
  if (contract.status !== 'UNDER_REVIEW') errors.push('العقد ليس قيد المراجعة.');
  if (!review) errors.push('يجب تسجيل المراجعة قبل الاعتماد.');
  if (review?.actor === actor) errors.push('المراجع والمعتمد يجب أن يكونا شخصين مختلفين.');
  if (errors.length) return result(contract, errors);
  const existing = new Set(contract.obligations.map(item => item.milestoneId));
  const generated: ContractObligation[] = contract.milestones.filter(item => !existing.has(item.id)).map(item => {
    const taxAmount = money(item.amount * item.taxRate);
    const retentionAmount = money(item.amount * item.retentionRate);
    const netAmount = money(item.amount + taxAmount - retentionAmount);
    return { id: `obl-${contract.id}-${item.id}`, milestoneId: item.id, title: item.title, dueDate: item.dueDate, grossAmount: money(item.amount), taxAmount, retentionAmount, netAmount, settledAmount: 0, status: 'OPEN', voucherLinks: [] };
  });
  return result({ ...contract, status: 'APPROVED', obligations: [...contract.obligations, ...generated], updatedAt: now(), actions: [...contract.actions, action('APPROVE', actor, `اعتماد العقد وتوليد ${generated.length} استحقاق`)] });
}

export function rejectContract(contract: ERPContract, actor: string, reason: string): ContractResult {
  const errors = contract.status !== 'UNDER_REVIEW' ? ['العقد ليس قيد المراجعة.'] : [];
  if (!reason.trim()) errors.push('سبب الرفض مطلوب.');
  if (errors.length) return result(contract, errors);
  return result({ ...contract, status: 'REJECTED', updatedAt: now(), actions: [...contract.actions, action('REJECT', actor, reason)] });
}

export function amendContract(contract: ERPContract, actor: string, reason: string, totalValue: number): ContractResult {
  const errors: string[] = [];
  if (contract.status !== 'APPROVED') errors.push('لا يُعدل إلا العقد المعتمد.');
  if (!reason.trim()) errors.push('سبب التعديل مطلوب.');
  if (!(totalValue > 0)) errors.push('القيمة المعدلة غير صحيحة.');
  if (errors.length) return result(contract, errors);
  const revision = (contract.amendments.at(-1)?.revision || 0) + 1;
  return result({ ...contract, status: 'UNDER_REVIEW', totalValue: money(totalValue), updatedAt: now(), amendments: [...contract.amendments, { id: `amd-${contract.id}-${revision}`, revision, reason, previousValue: contract.totalValue, newValue: money(totalValue), createdBy: actor, createdAt: now() }], actions: [...contract.actions, action('AMEND', actor, reason)] });
}

export function linkContractVoucher(contract: ERPContract, obligationId: string, link: Omit<ContractVoucherLink, 'id' | 'linkedAt'>): ContractResult {
  if (contract.status !== 'APPROVED') return result(contract, ['العقد غير معتمد.']);
  const obligation = contract.obligations.find(item => item.id === obligationId);
  if (!obligation) return result(contract, ['الاستحقاق غير موجود.']);
  if (obligation.voucherLinks.some(item => item.voucherId === link.voucherId)) return result(contract, ['السند مرتبط بهذا الاستحقاق مسبقًا.']);
  const remaining = money(obligation.netAmount - obligation.settledAmount);
  if (!(link.amount > 0) || link.amount - remaining > 0.01) return result(contract, ['قيمة الربط تتجاوز الرصيد المتبقي.']);
  const voucherLink: ContractVoucherLink = { ...link, id: `cvl-${Date.now()}`, linkedAt: now() };
  const obligations = contract.obligations.map(item => {
    if (item.id !== obligationId) return item;
    const settledAmount = money(item.settledAmount + link.amount);
    return { ...item, settledAmount, status: settledAmount >= item.netAmount - 0.01 ? 'PAID' as const : 'PARTIAL' as const, voucherLinks: [...item.voucherLinks, voucherLink] };
  });
  const complete = obligations.every(item => item.status === 'PAID' || item.status === 'CANCELLED');
  return result({ ...contract, status: complete ? 'COMPLETED' : contract.status, obligations, updatedAt: now(), actions: [...contract.actions, action(complete ? 'COMPLETE' : 'LINK_VOUCHER', link.linkedBy, `${link.voucherNumber} — ${link.amount}`)] });
}

export function cancelContract(contract: ERPContract, actor: string, reason: string): ContractResult {
  if (!reason.trim()) return result(contract, ['سبب الإلغاء مطلوب.']);
  if (contract.status === 'COMPLETED' || contract.status === 'CANCELLED') return result(contract, ['العقد منتهٍ بالفعل.']);
  if (contract.obligations.some(item => item.settledAmount > 0)) return result(contract, ['لا يمكن إلغاء عقد عليه تسويات؛ استخدم تعديلًا أو سندًا عكسيًا.']);
  return result({ ...contract, status: 'CANCELLED', obligations: contract.obligations.map(item => ({ ...item, status: 'CANCELLED' })), updatedAt: now(), actions: [...contract.actions, action('CANCEL', actor, reason)] });
}

export function contractMetrics(contracts: ERPContract[], today = new Date().toISOString().slice(0, 10)) {
  const obligations = contracts.flatMap(contract => contract.obligations.map(obligation => ({ contract, obligation })));
  return {
    approvedCommitments: money(contracts.filter(item => item.status === 'APPROVED').reduce((sum, item) => sum + item.totalValue, 0)),
    outstanding: money(obligations.reduce((sum, item) => sum + Math.max(0, item.obligation.netAmount - item.obligation.settledAmount), 0)),
    overdue: money(obligations.filter(item => item.obligation.dueDate < today && !['PAID', 'CANCELLED'].includes(item.obligation.status)).reduce((sum, item) => sum + item.obligation.netAmount - item.obligation.settledAmount, 0)),
    upcoming: obligations.filter(item => item.obligation.dueDate >= today && !['PAID', 'CANCELLED'].includes(item.obligation.status)).length
  };
}
