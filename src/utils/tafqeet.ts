const ones = [
  '',
  'واحد',
  'اثنان',
  'ثلاثة',
  'أربعة',
  'خمسة',
  'ستة',
  'سبعة',
  'ثمانية',
  'تسعة',
  'عشرة',
  'أحد عشر',
  'اثنا عشر',
  'ثلاثة عشر',
  'أربعة عشر',
  'خمسة عشر',
  'ستة عشر',
  'سبعة عشر',
  'ثمانية عشر',
  'تسعة عشر'
];

const tens = [
  '',
  '',
  'عشرون',
  'ثلاثون',
  'أربعون',
  'خمسون',
  'ستون',
  'سبعون',
  'ثمانون',
  'تسعون'
];

const hundreds = [
  '',
  'مائة',
  'مائتان',
  'ثلاثمائة',
  'أربعمائة',
  'خمسعمائة',
  'ستمائة',
  'سبعمائة',
  'ثمانمائة',
  'تسعمائة'
];

function convertGroup(num: number): string {
  if (num === 0) return '';
  const parts: string[] = [];

  const h = Math.floor(num / 100);
  const remainder = num % 100;

  if (h > 0) {
    parts.push(hundreds[h]);
  }

  if (remainder > 0) {
    if (remainder < 20) {
      parts.push(ones[remainder]);
    } else {
      const t = Math.floor(remainder / 10);
      const o = remainder % 10;
      if (o > 0) {
        parts.push(`${ones[o]} و${tens[t]}`);
      } else {
        parts.push(tens[t]);
      }
    }
  }

  return parts.join(' و');
}

export function tafqeet(amount: number, currencyName = 'ريال يمني', decimalName = 'فلس'): string {
  if (amount === 0 || isNaN(amount)) {
    return `صفر ${currencyName} لا غير`;
  }

  const positiveAmount = Math.abs(amount);
  const integerPart = Math.floor(positiveAmount);
  const decimalPart = Math.round((positiveAmount - integerPart) * 100);

  const parts: string[] = [];

  const billions = Math.floor(integerPart / 1000000000);
  const millionsRem = integerPart % 1000000000;

  const millions = Math.floor(millionsRem / 1000000);
  const thousandsRem = millionsRem % 1000000;

  if (billions > 0) {
    if (billions === 1) {
      parts.push('مليار');
    } else if (billions === 2) {
      parts.push('ملياران');
    } else if (billions >= 3 && billions <= 10) {
      parts.push(`${convertGroup(billions)} مليارات`);
    } else {
      parts.push(`${convertGroup(billions)} مليار`);
    }
  }

  if (millions > 0) {
    if (millions === 1) {
      parts.push('مليون');
    } else if (millions === 2) {
      parts.push('مليونان');
    } else if (millions >= 3 && millions <= 10) {
      parts.push(`${convertGroup(millions)} ملايين`);
    } else {
      parts.push(`${convertGroup(millions)} مليون`);
    }
  }

  const thousands = Math.floor(thousandsRem / 1000);
  const units = thousandsRem % 1000;

  if (thousands > 0) {
    if (thousands === 1) {
      parts.push('ألف');
    } else if (thousands === 2) {
      parts.push('ألفان');
    } else if (thousands >= 3 && thousands <= 10) {
      parts.push(`${convertGroup(thousands)} آلاف`);
    } else {
      parts.push(`${convertGroup(thousands)} ألف`);
    }
  }

  if (units > 0) {
    parts.push(convertGroup(units));
  }

  let result = 'فقط ';

  if (parts.length > 0) {
    result += parts.join(' و') + ` ${currencyName}`;
  }

  if (decimalPart > 0) {
    const decimalWords = convertGroup(decimalPart);
    if (parts.length > 0) {
      result += ` و${decimalWords} ${decimalName}`;
    } else {
      result += `${decimalWords} ${decimalName}`;
    }
  }

  result += ' لا غير';
  return result;
}
