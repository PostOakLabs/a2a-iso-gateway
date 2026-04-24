import { MappingWarning } from '../types';

// ISO 13616 MOD-97 check digit calculation
function mod97(str: string): number {
  let remainder = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const digit = isNaN(Number(char)) ? char.charCodeAt(0) - 55 : Number(char);
    remainder = ((remainder * (digit >= 10 ? 100 : 10)) + digit) % 97;
  }
  return remainder;
}

function calculateIBANCheckDigits(countryCode: string, bban: string): string {
  // Move country + "00" to end, convert letters to numbers, MOD 97
  const rearranged = bban + countryCode + '00';
  const numeric = rearranged
    .toUpperCase()
    .split('')
    .map((c) => (isNaN(Number(c)) ? String(c.charCodeAt(0) - 55) : c))
    .join('');
  const checkDigit = 98 - mod97(numeric);
  return String(checkDigit).padStart(2, '0');
}

export function parseSortCodeAccountNumber(
  identification: string
): { sortCode: string; accountNumber: string } | null {
  // Handles: "20-00-00/55779911", "200000 55779911", "20-00-00 55779911", "2000055779911"
  const formats = [
    /^(\d{2}-\d{2}-\d{2})\/(\d{7,8})$/,  // 20-00-00/55779911
    /^(\d{2}-\d{2}-\d{2})\s(\d{7,8})$/,  // 20-00-00 55779911
    /^(\d{6})\s(\d{7,8})$/,               // 200000 55779911
    /^(\d{14})$/,                          // 2000055779911 (6+8)
  ];

  for (const pattern of formats) {
    const match = identification.match(pattern);
    if (match) {
      if (match.length === 2) {
        // 14-digit combined
        const combined = match[1].replace(/-/g, '');
        return {
          sortCode: combined.slice(0, 6),
          accountNumber: combined.slice(6),
        };
      }
      const sortCode = match[1].replace(/-/g, '');
      const accountNumber = match[2];
      if (sortCode.length === 6) {
        return { sortCode, accountNumber };
      }
    }
  }

  // Last resort: strip all non-digits
  const digits = identification.replace(/\D/g, '');
  if (digits.length === 14) {
    return {
      sortCode: digits.slice(0, 6),
      accountNumber: digits.slice(6),
    };
  }

  return null;
}

export function convertSortCodeToIBAN(
  sortCode: string,
  accountNumber: string
): { iban: string; warning: MappingWarning } {
  const cleanSortCode = sortCode.replace(/\D/g, '').padEnd(6, '0').slice(0, 6);
  const cleanAccount = accountNumber.replace(/\D/g, '').padStart(8, '0').slice(0, 8);

  // BBAN: 4-letter bank code (NWBK placeholder) + 6-digit sort code + 8-digit account
  const bban = 'NWBK' + cleanSortCode + cleanAccount;
  const checkDigits = calculateIBANCheckDigits('GB', bban);
  const iban = `GB${checkDigits}${bban}`;

  const warning: MappingWarning = {
    field: 'creditorAccount.Identification',
    severity: 'WARNING',
    message:
      `pseudo-IBAN generated from sort code ${cleanSortCode} and account ${cleanAccount}. ` +
      'This is NOT a real IBAN — the bank code "NWBK" is a placeholder. ' +
      'Real IBANs require the actual bank identifier. Use only for internal routing or testing.',
    isoPath: 'CdtTrfTxInf/CdtrAcct/Id/IBAN',
  };

  return { iban, warning };
}
