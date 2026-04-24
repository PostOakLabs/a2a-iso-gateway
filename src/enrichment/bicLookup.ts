import { MappingWarning } from '../types';

// Hardcoded stub table: UK sort code prefix → BIC
const SORT_CODE_PREFIX_TO_BIC: Record<string, { bic: string; bankName: string }> = {
  '20': { bic: 'BARCGB22', bankName: 'Barclays' },
  '30': { bic: 'LOYDGB21', bankName: 'Lloyds' },
  '31': { bic: 'LOYDGB21', bankName: 'Lloyds' },
  '32': { bic: 'LOYDGB21', bankName: 'Lloyds' },
  '40': { bic: 'HBUKGB4B', bankName: 'HSBC' },
  '60': { bic: 'NWBKGB2L', bankName: 'NatWest' },
  '56': { bic: 'NWBKGB2L', bankName: 'NatWest' },
  '09': { bic: 'ABBYGB2L', bankName: 'Santander' },
  '04': { bic: 'MONZGB2L', bankName: 'Monzo' },
  '15': { bic: 'HBUKGB4B', bankName: 'HSBC' },
  '23': { bic: 'BARCGB22', bankName: 'Barclays' },
  '18': { bic: 'RBSSGB2L', bankName: 'Royal Bank of Scotland' },
  '83': { bic: 'RBSSGB2L', bankName: 'Royal Bank of Scotland' },
  '08': { bic: 'CPBKGB22', bankName: 'Co-operative Bank' },
  '53': { bic: 'METRGB21', bankName: 'Metro Bank' },
  '23-69': { bic: 'SRLGGB3L', bankName: 'Starling' },
  '04-00-04': { bic: 'SRLGGB3L', bankName: 'Starling' },
};

// Override map: allows callers to register their own sort code → BIC mappings
const overrides: Record<string, string> = {};

export function setBICOverride(sortCode: string, bic: string): void {
  const clean = sortCode.replace(/\D/g, '').slice(0, 6);
  overrides[clean] = bic;
}

export function clearBICOverrides(): void {
  Object.keys(overrides).forEach((k) => delete overrides[k]);
}

export function lookupBIC(
  sortCode: string
): { bic: string | undefined; warning: MappingWarning | null } {
  const clean = sortCode.replace(/\D/g, '').slice(0, 6);

  // Check caller overrides first
  if (overrides[clean]) {
    return { bic: overrides[clean], warning: null };
  }

  // Full 6-digit exact match (for special entries like 040004)
  const fullEntry = SORT_CODE_PREFIX_TO_BIC[clean];
  if (fullEntry) {
    return { bic: fullEntry.bic, warning: null };
  }

  // 2-digit prefix match
  const prefix2 = clean.slice(0, 2);
  const entry = SORT_CODE_PREFIX_TO_BIC[prefix2];
  if (entry) {
    return { bic: entry.bic, warning: null };
  }

  const warning: MappingWarning = {
    field: 'sortCode',
    severity: 'WARNING',
    message:
      `BIC could not be resolved for sort code ${sortCode}. ` +
      'Using stub lookup — register an override via setBICOverride() or provide instructingAgentBIC in TranslationOptions.',
    isoPath: 'DbtrAgt/FinInstnId/BICFI',
  };

  return { bic: undefined, warning };
}
