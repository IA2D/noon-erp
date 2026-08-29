export const fmtAmount = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtNum = (n: number): string =>
  n.toLocaleString('en-US');

export const fmtAmountCur = (n: number, code?: string): string => {
  const s = fmtAmount(n);
  return code ? `${s} ${code}` : s;
};
