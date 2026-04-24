import { MappingWarning } from '../types';

const OB_TO_ISO_PURPOSE: Record<string, string> = {
  BKDF: 'BKDF',
  BKFE: 'BKFE',
  BKFM: 'BKFM',
  BKIP: 'BKIP',
  BKPP: 'BKPP',
  CBLK: 'CBLK',
  CDCD: 'CDCD',
  CDCS: 'CDCS',
  CDDP: 'CDDP',
  CDOC: 'CDOC',
  CDQC: 'CDQC',
  COST: 'COST',
  CPYR: 'CPYR',
  DBTC: 'DBTC',
  DEPT: 'DEPT',
  DIVD: 'DIVD',
  DMEQ: 'DMEQ',
  DNTS: 'DNTS',
  EDUC: 'EDUC',
  ELEC: 'ELEC',
  ENRG: 'ENRG',
  ESTX: 'ESTX',
  FERR: 'FERR',
  FLGT: 'FLGT',
  FREX: 'FREX',
  GDDS: 'GDDS',
  GDSV: 'GDSV',
  GOVI: 'GOVI',
  GOVT: 'GOVT',
  GSCB: 'GSCB',
  GWLT: 'GWLT',
  HLRP: 'HLRP',
  HLTC: 'HLTC',
  HLTI: 'HLTI',
  HSPC: 'HSPC',
  HSTX: 'HSTX',
  ICCP: 'ICCP',
  ICRF: 'ICRF',
  IHRP: 'IHRP',
  INPC: 'INPC',
  INPR: 'INPR',
  INSC: 'INSC',
  INSU: 'INSU',
  INTC: 'INTC',
  INTE: 'INTE',
  INVS: 'INVS',
  LBRI: 'LBRI',
  LICF: 'LICF',
  LIFI: 'LIFI',
  LOAN: 'LOAN',
  LOAR: 'LOAR',
  LOTT: 'LOTT',
  LTCF: 'LTCF',
  MDCS: 'MDCS',
  MGGT: 'MGGT',
  MNTH: 'MNTH',
  MOMA: 'MOMA',
  MSVC: 'MSVC',
  NETT: 'NETT',
  NITX: 'NITX',
  NOWS: 'NOWS',
  NWCH: 'NWCH',
  NWCM: 'NWCM',
  OFEE: 'OFEE',
  OTHR: 'OTHR',
  PADD: 'PADD',
  PEFC: 'PEFC',
  PENS: 'PENS',
  PHON: 'PHON',
  POPE: 'POPE',
  PPEX: 'PPEX',
  PRME: 'PRME',
  PTSP: 'PTSP',
  RCKE: 'RCKE',
  RCPT: 'RCPT',
  REBT: 'REBT',
  REFU: 'REFU',
  RENT: 'RENT',
  RINP: 'RINP',
  RLWY: 'RLWY',
  ROYA: 'ROYA',
  SALA: 'SALA',
  SAVG: 'SAVG',
  SCVE: 'SCVE',
  SECU: 'SECU',
  SSBE: 'SSBE',
  STDY: 'STDY',
  SUBS: 'SUBS',
  SUPP: 'SUPP',
  TAXS: 'TAXS',
  TELI: 'TELI',
  TRAD: 'TRAD',
  TREA: 'TREA',
  TRFD: 'TRFD',
  VATX: 'VATX',
  VIEW: 'VIEW',
  WEBI: 'WEBI',
  WTER: 'WTER',
};

// POL extension: tokenized MMF subscription maps to SECU with a warning
const POL_EXTENSION_CODES: Record<string, { isoCode: string; warningMessage: string }> = {
  TMMF: {
    isoCode: 'SECU',
    warningMessage:
      'POL extension code TMMF (Tokenized MMF Subscription) mapped to ISO 20022 SECU. ' +
      'Downstream systems should inspect TokenizationInstruction for full MMF details.',
  },
};

export function mapPurposeCode(obCode: string | undefined): {
  code: string | undefined;
  warning: string | null;
} {
  if (!obCode) {
    return { code: undefined, warning: null };
  }

  const polExt = POL_EXTENSION_CODES[obCode];
  if (polExt) {
    return { code: polExt.isoCode, warning: polExt.warningMessage };
  }

  const isoCode = OB_TO_ISO_PURPOSE[obCode];
  if (isoCode) {
    return { code: isoCode, warning: null };
  }

  return {
    code: 'OTHR',
    warning: `Unknown OB UK purpose code '${obCode}' mapped to ISO 20022 fallback 'OTHR'. Verify this is correct.`,
  };
}

export function purposeCodeWarning(
  obCode: string | undefined,
  isoPath: string
): MappingWarning | null {
  const { warning } = mapPurposeCode(obCode);
  if (!warning) return null;
  return {
    field: 'purposeCode',
    severity: 'WARNING',
    message: warning,
    isoPath,
  };
}
