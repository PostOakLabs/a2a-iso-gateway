import { mapPurposeCode } from '../../src/enrichment/purposeCodes';
import { convertSortCodeToIBAN, parseSortCodeAccountNumber } from '../../src/enrichment/sortCode';
import { lookupBIC, setBICOverride, clearBICOverrides } from '../../src/enrichment/bicLookup';
import { generateRemittance } from '../../src/enrichment/remittance';

describe('purposeCodes', () => {
  test('maps known OB UK codes directly', () => {
    expect(mapPurposeCode('SALA')).toEqual({ code: 'SALA', warning: null });
    expect(mapPurposeCode('GDDS')).toEqual({ code: 'GDDS', warning: null });
    expect(mapPurposeCode('LOAN')).toEqual({ code: 'LOAN', warning: null });
    expect(mapPurposeCode('TREA')).toEqual({ code: 'TREA', warning: null });
    expect(mapPurposeCode('PENS')).toEqual({ code: 'PENS', warning: null });
    expect(mapPurposeCode('TAXS')).toEqual({ code: 'TAXS', warning: null });
    expect(mapPurposeCode('SECU')).toEqual({ code: 'SECU', warning: null });
  });

  test('returns OTHR with warning for unknown code', () => {
    const result = mapPurposeCode('ZZZZ');
    expect(result.code).toBe('OTHR');
    expect(result.warning).toContain('ZZZZ');
  });

  test('returns undefined for undefined input', () => {
    expect(mapPurposeCode(undefined)).toEqual({ code: undefined, warning: null });
  });

  test('maps POL TMMF extension to SECU with warning', () => {
    const result = mapPurposeCode('TMMF');
    expect(result.code).toBe('SECU');
    expect(result.warning).toContain('TMMF');
    expect(result.warning).toContain('TokenizationInstruction');
  });
});

describe('sortCode', () => {
  describe('parseSortCodeAccountNumber', () => {
    test('parses dash-slash format', () => {
      const result = parseSortCodeAccountNumber('20-00-00/55779911');
      expect(result).toEqual({ sortCode: '200000', accountNumber: '55779911' });
    });

    test('parses dash-space format', () => {
      const result = parseSortCodeAccountNumber('20-00-00 55779911');
      expect(result).toEqual({ sortCode: '200000', accountNumber: '55779911' });
    });

    test('parses space-separated format', () => {
      const result = parseSortCodeAccountNumber('200000 55779911');
      expect(result).toEqual({ sortCode: '200000', accountNumber: '55779911' });
    });

    test('parses concatenated 14-digit format', () => {
      const result = parseSortCodeAccountNumber('20000055779911');
      expect(result?.sortCode).toBe('200000');
    });

    test('returns null for invalid format', () => {
      expect(parseSortCodeAccountNumber('not-a-sort-code')).toBeNull();
    });
  });

  describe('convertSortCodeToIBAN', () => {
    test('generates pseudo-IBAN starting with GB', () => {
      const { iban } = convertSortCodeToIBAN('200000', '55779911');
      expect(iban).toMatch(/^GB\d{2}NWBK\d{14}$/);
    });

    test('includes warning about pseudo-IBAN', () => {
      const { warning } = convertSortCodeToIBAN('200000', '55779911');
      expect(warning.severity).toBe('WARNING');
      expect(warning.message).toContain('pseudo-IBAN');
      expect(warning.message).toContain('placeholder');
    });

    test('pads short account numbers', () => {
      const { iban } = convertSortCodeToIBAN('200000', '12345');
      // Account should be padded to 8 digits
      expect(iban).toContain('00012345');
    });
  });
});

describe('bicLookup', () => {
  afterEach(() => clearBICOverrides());

  test('resolves Barclays sort code prefix', () => {
    const { bic, warning } = lookupBIC('200000');
    expect(bic).toBe('BARCGB22');
    expect(warning).toBeNull();
  });

  test('resolves Lloyds sort code prefix', () => {
    const { bic } = lookupBIC('301234');
    expect(bic).toBe('LOYDGB21');
  });

  test('resolves HSBC sort code prefix', () => {
    const { bic } = lookupBIC('401234');
    expect(bic).toBe('HBUKGB4B');
  });

  test('resolves NatWest sort code prefix', () => {
    const { bic } = lookupBIC('600000');
    expect(bic).toBe('NWBKGB2L');
  });

  test('returns warning for unknown sort code', () => {
    const { bic, warning } = lookupBIC('990000');
    expect(bic).toBeUndefined();
    expect(warning?.severity).toBe('WARNING');
    expect(warning?.message).toContain('990000');
  });

  test('override takes precedence over stub table', () => {
    setBICOverride('200000', 'TESTGB22');
    const { bic, warning } = lookupBIC('200000');
    expect(bic).toBe('TESTGB22');
    expect(warning).toBeNull();
  });
});

describe('remittance', () => {
  test('returns structured for invoice reference', () => {
    const result = generateRemittance('INV-12345');
    expect(result.structured?.creditorReference).toBe('INV-12345');
    expect(result.unstructured).toBeUndefined();
  });

  test('returns structured for REF pattern', () => {
    const result = generateRemittance('REF-ABC123');
    expect(result.structured?.creditorReference).toBe('REF-ABC123');
  });

  test('returns structured for SI pattern', () => {
    const result = generateRemittance('SI001');
    expect(result.structured?.creditorReference).toBe('SI001');
  });

  test('returns unstructured for free text', () => {
    const result = generateRemittance('payment for goods and services rendered');
    expect(result.unstructured).toBe('payment for goods and services rendered');
    expect(result.structured).toBeUndefined();
  });

  test('falls back to unstructured param when reference absent', () => {
    const result = generateRemittance(undefined, 'some free text');
    expect(result.unstructured).toBe('some free text');
  });

  test('returns empty object when both undefined', () => {
    const result = generateRemittance();
    expect(result.structured).toBeUndefined();
    expect(result.unstructured).toBeUndefined();
  });
});
