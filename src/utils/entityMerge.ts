import type { AccountCurrency, Customer, Employee, EntityMergeRecord, Vendor } from '../types/erp';
import type { ERPContract } from '../types/contracts';

export type MergeEntityKind = 'CUSTOMER' | 'VENDOR' | 'EMPLOYEE';
export type MergeEntity = Customer | Vendor | Employee;
export interface DuplicateCandidate { kind: MergeEntityKind; firstId: string; secondId: string; firstCode: string; secondCode: string; firstName: string; secondName: string; score: number; reasons: string[] }

const normalize = (value: unknown) => String(value || '').trim().toLocaleLowerCase('ar').replace(/[\s\-_.،,]/g, '');
const meaningful = (value: unknown) => normalize(value).length >= 3;
const fieldsFor = (kind: MergeEntityKind, entity: MergeEntity): Array<[string, unknown]> => kind === 'EMPLOYEE'
  ? [['الهوية', (entity as Employee).nationalId], ['الجوال', entity.phone], ['البريد', entity.email], ['الاسم', entity.nameAr]]
  : [['الرقم الضريبي', (entity as Customer | Vendor).vatNumber], ['السجل التجاري', (entity as Customer | Vendor).commercialRegistration], ['الجوال', entity.phone], ['البريد', entity.email], ['الاسم', entity.nameAr]];

export function findDuplicateEntities(kind: MergeEntityKind, entities: MergeEntity[]): DuplicateCandidate[] {
  const active = entities.filter(item => item.isActive && !item.mergedIntoId);
  const candidates: DuplicateCandidate[] = [];
  for (let i = 0; i < active.length; i += 1) for (let j = i + 1; j < active.length; j += 1) {
    const left = fieldsFor(kind, active[i]); const right = fieldsFor(kind, active[j]);
    const reasons = left.flatMap(([label, value], index) => meaningful(value) && normalize(value) === normalize(right[index][1]) ? [label] : []);
    const strong = reasons.some(reason => ['الهوية', 'الرقم الضريبي', 'السجل التجاري'].includes(reason));
    const score = Math.min(100, reasons.length * 25 + (strong ? 35 : 0));
    if (score >= 50) candidates.push({ kind, firstId: active[i].id, secondId: active[j].id, firstCode: active[i].code, secondCode: active[j].code, firstName: active[i].nameAr, secondName: active[j].nameAr, score, reasons });
  }
  return candidates.sort((a, b) => b.score - a.score);
}

const mergeCurrencies = (target: AccountCurrency[], source: AccountCurrency[]) => {
  const map = new Map<string, AccountCurrency>();
  [...target, ...source].forEach(item => map.set(item.code, { ...(map.get(item.code) || item), ...item, isActive: Boolean(item.isActive || map.get(item.code)?.isActive), isDefault: Boolean(item.isDefault || map.get(item.code)?.isDefault) }));
  return Array.from(map.values());
};

export interface MergeData { customers: Customer[]; vendors: Vendor[]; employees: Employee[]; contracts: ERPContract[] }
export interface MergeResult extends MergeData { ok: boolean; errors: string[]; record?: EntityMergeRecord }

export function mergeDuplicateEntity(kind: MergeEntityKind, sourceId: string, targetId: string, actor: string, reason: string, data: MergeData): MergeResult {
  const list = kind === 'CUSTOMER' ? data.customers : kind === 'VENDOR' ? data.vendors : data.employees;
  const source = list.find(item => item.id === sourceId); const target = list.find(item => item.id === targetId);
  const errors: string[] = [];
  if (!source || !target || source.id === target.id) errors.push('حدد سجلين مختلفين وصحيحين.');
  if (source && (!source.isActive || source.mergedIntoId)) errors.push('السجل المصدر غير نشط أو مدمج مسبقًا.');
  if (target && (!target.isActive || target.mergedIntoId)) errors.push('السجل الهدف غير نشط.');
  if (!reason.trim()) errors.push('سبب الدمج مطلوب.');
  if (source?.linkedAccountId && target?.linkedAccountId && source.linkedAccountId !== target.linkedAccountId) errors.push('السجلان مرتبطان بحسابين رقابيين مختلفين؛ نفّذ تحويل حساب الربط أولًا.');
  if (errors.length || !source || !target) return { ...data, ok: false, errors };
  const record: EntityMergeRecord = { sourceId, targetId, sourceCode: source.code, targetCode: target.code, reason, mergedBy: actor, mergedAt: new Date().toISOString() };
  const combined = {
    ...source, ...target,
    nameAr: target.nameAr || source.nameAr, nameEn: target.nameEn || source.nameEn,
    phone: target.phone || source.phone, email: target.email || source.email,
    linkedAccountId: target.linkedAccountId || source.linkedAccountId,
    openingBalance: Number(target.openingBalance || 0) + Number(source.openingBalance || 0),
    openingBalanceForeign: Number(target.openingBalanceForeign || 0) + Number(source.openingBalanceForeign || 0),
    openingBalances: [...(target.openingBalances || []), ...(source.openingBalances || [])],
    currencies: mergeCurrencies(target.currencies || [], source.currencies || []),
    mergeHistory: [...(target.mergeHistory || []), record], isActive: true, mergedIntoId: undefined
  } as MergeEntity;
  const archived = { ...source, isActive: false, mergedIntoId: targetId, mergeHistory: [...(source.mergeHistory || []), record] } as MergeEntity;
  const mergedList = list.map(item => item.id === targetId ? combined : item.id === sourceId ? archived : item);
  const contracts = data.contracts.map(contract => contract.partyType === kind && contract.partyId === sourceId && ['CREATED', 'UNDER_REVIEW', 'REJECTED'].includes(contract.status) ? { ...contract, partyId: targetId, partyName: target.nameAr, updatedAt: new Date().toISOString() } : contract);
  return {
    ok: true, errors: [], record, contracts,
    customers: kind === 'CUSTOMER' ? mergedList as Customer[] : data.customers,
    vendors: kind === 'VENDOR' ? mergedList as Vendor[] : data.vendors,
    employees: kind === 'EMPLOYEE' ? mergedList as Employee[] : data.employees
  };
}
