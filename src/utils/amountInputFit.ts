/** يُصغّر خط خانة الرقم آلياً عند امتلاء العرض من دون إخفاء القيمة. */
export function fitAmountInput(input: HTMLInputElement): void {
  const style = window.getComputedStyle(input);
  const base = Number(input.dataset.amountBaseFontSize || style.fontSize.replace('px', '')) || 16;
  if (!input.dataset.amountBaseFontSize) input.dataset.amountBaseFontSize = String(base);
  const available = input.clientWidth - Number.parseFloat(style.paddingLeft || '0') - Number.parseFloat(style.paddingRight || '0') - 6;
  if (available <= 0) return;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return;
  context.font = `${style.fontWeight} ${base}px ${style.fontFamily}`;
  const width = context.measureText(input.value || '0').width;
  const next = Math.max(10, Math.min(base, base * Math.min(1, available / Math.max(width, 1))));
  input.classList.add('adaptive-amount-input');
  input.style.setProperty('--amount-font-size', `${next.toFixed(2)}px`);
}

export function isAmountInput(input: HTMLInputElement): boolean {
  return input.dataset.amountInput === 'true' || input.type === 'number' || input.inputMode === 'decimal';
}
