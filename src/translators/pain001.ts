import { create } from 'xmlbuilder2';
import { v4 as uuidv4 } from 'uuid';
import {
  OBDomesticPaymentRequest,
  FDXPaymentInitiation,
  TranslationOptions,
  ISO20022Result,
  MappingWarning,
} from '../types';
import { mapPurposeCode } from '../enrichment/purposeCodes';
import { convertSortCodeToIBAN, parseSortCodeAccountNumber } from '../enrichment/sortCode';
import { lookupBIC } from '../enrichment/bicLookup';
import { generateRemittance } from '../enrichment/remittance';
import { validateXML } from '../validators/xmlValidator';
import { generateTokenizationInstruction } from '../tokenization/mmfExtension';

function isoDateTime(dt?: string): string {
  return dt ? new Date(dt).toISOString() : new Date().toISOString();
}

function isoDate(dt?: string): string {
  return (dt ? new Date(dt) : new Date()).toISOString().split('T')[0];
}

export function translateOBDomesticPayment(
  payment: OBDomesticPaymentRequest,
  options: TranslationOptions = {}
): ISO20022Result {
  const warnings: MappingWarning[] = [];
  const messageId = uuidv4();
  const creationDateTime = isoDateTime(payment.Data.CreationDateTime);
  const initiation = payment.Data.Initiation;

  // ── Creditor account resolution ──────────────────────────────────────────
  let creditorIBAN: string | undefined;
  let creditorBBAN: string | undefined;
  const credAcct = initiation.CreditorAccount;

  if (credAcct.SchemeName === 'UK.OBIE.IBAN') {
    creditorIBAN = credAcct.Identification;
  } else if (credAcct.SchemeName === 'UK.OBIE.SortCodeAccountNumber') {
    const parsed = parseSortCodeAccountNumber(credAcct.Identification);
    if (parsed && options.convertSortCodeToIBAN !== false) {
      const { iban, warning } = convertSortCodeToIBAN(parsed.sortCode, parsed.accountNumber);
      creditorIBAN = iban;
      warnings.push(warning);
    } else {
      warnings.push({
        field: 'creditorAccount.Identification',
        severity: 'WARNING',
        message: `Could not parse sort code account number: ${credAcct.Identification}`,
        isoPath: 'CdtTrfTxInf/CdtrAcct/Id',
      });
    }
  } else if (credAcct.SchemeName === 'UK.OBIE.PAN') {
    warnings.push({
      field: 'creditorAccount.SchemeName',
      severity: 'ERROR',
      message: 'UK.OBIE.PAN cannot be converted to ISO 20022 account identification. Creditor account block will be empty.',
      isoPath: 'CdtTrfTxInf/CdtrAcct/Id',
    });
  } else if (credAcct.SchemeName === 'UK.OBIE.Paym') {
    warnings.push({
      field: 'creditorAccount.SchemeName',
      severity: 'WARNING',
      message: 'UK.OBIE.Paym (mobile number) cannot be converted to IBAN. Creditor account block will be empty.',
      isoPath: 'CdtTrfTxInf/CdtrAcct/Id',
    });
  }

  // ── Debtor account resolution ─────────────────────────────────────────────
  let debtorIBAN: string | undefined;
  let debtorBIC: string | undefined;
  const debtorAcct = initiation.DebtorAccount;

  if (debtorAcct) {
    if (debtorAcct.SchemeName === 'UK.OBIE.IBAN') {
      debtorIBAN = debtorAcct.Identification;
    } else if (debtorAcct.SchemeName === 'UK.OBIE.SortCodeAccountNumber') {
      const parsed = parseSortCodeAccountNumber(debtorAcct.Identification);
      if (parsed) {
        if (options.convertSortCodeToIBAN !== false) {
          const { iban, warning } = convertSortCodeToIBAN(parsed.sortCode, parsed.accountNumber);
          debtorIBAN = iban;
          warnings.push({ ...warning, field: 'debtorAccount.Identification', isoPath: 'DbtrAcct/Id/IBAN' });
        }
        if (!options.instructingAgentBIC) {
          const { bic, warning } = lookupBIC(parsed.sortCode);
          debtorBIC = bic;
          if (warning) warnings.push(warning);
        }
      }
    }
  } else {
    warnings.push({
      field: 'debtorAccount',
      severity: 'INFO',
      message: 'No debtor account specified (anonymous payer). DbtrAcct block will be omitted.',
      isoPath: 'PmtInf/DbtrAcct',
    });
  }

  if (options.instructingAgentBIC) {
    debtorBIC = options.instructingAgentBIC;
  }

  // ── Creditor BIC ──────────────────────────────────────────────────────────
  let creditorBIC: string | undefined = options.instructedAgentBIC;
  if (!creditorBIC && credAcct.SchemeName === 'UK.OBIE.SortCodeAccountNumber') {
    const parsed = parseSortCodeAccountNumber(credAcct.Identification);
    if (parsed) {
      const { bic, warning } = lookupBIC(parsed.sortCode);
      creditorBIC = bic;
      if (warning) warnings.push({ ...warning, isoPath: 'CdtTrfTxInf/CdtrAgt/FinInstnId/BICFI' });
    }
  }

  // ── Payment type info ─────────────────────────────────────────────────────
  const currency = initiation.InstructedAmount.Currency;
  const paymentContext = payment.Data.PaymentContextCode || payment.Risk.PaymentContextCode;

  let svcLvlCode: string | undefined;
  let lclInstrmCode: string | undefined;

  if (currency === 'EUR') {
    svcLvlCode = 'SEPA';
  } else if (currency === 'GBP') {
    lclInstrmCode = 'FASTER';
    if (paymentContext === 'PartyToParty') {
      svcLvlCode = 'NURG';
    }
  } else {
    warnings.push({
      field: 'InstructedAmount.Currency',
      severity: 'INFO',
      message: `Currency ${currency} not GBP or EUR — defaulting to SvcLvl NURG. Cross-currency not supported in v0.1.`,
      isoPath: 'PmtInf/PmtTpInf/SvcLvl',
    });
    svcLvlCode = 'NURG';
  }

  // ── Purpose code ──────────────────────────────────────────────────────────
  const mmfMeta = initiation.SupplementaryData?.TokenizedMMFMetadata;
  const rawPurposeCode = options.purposeCodeOverride || (mmfMeta ? 'TMMF' : undefined);
  const { code: purposeCode, warning: purposeWarning } = mapPurposeCode(rawPurposeCode);
  if (purposeWarning) {
    warnings.push({ field: 'purposeCode', severity: 'WARNING', message: purposeWarning, isoPath: 'CdtTrfTxInf/Purp/Cd' });
  }

  // ── Remittance ────────────────────────────────────────────────────────────
  const remit = generateRemittance(
    initiation.RemittanceInformation?.Reference,
    initiation.RemittanceInformation?.Unstructured
  );

  // ── Build XML ─────────────────────────────────────────────────────────────
  const debtorName = payment.Data.DebtorName || 'UNKNOWN';
  const creditorName = initiation.CreditorAccount.Name || 'UNKNOWN';
  const amount = initiation.InstructedAmount.Amount;

  const doc = create({ version: '1.0', encoding: 'UTF-8' });
  const document = doc.ele('Document', { xmlns: 'urn:iso:std:iso:20022:tech:xsd:pain.001.001.09' });
  const cstmr = document.ele('CstmrCdtTrfInitn');

  const grpHdr = cstmr.ele('GrpHdr');
  grpHdr.ele('MsgId').txt(messageId);
  grpHdr.ele('CreDtTm').txt(creationDateTime);
  grpHdr.ele('NbOfTxs').txt('1');
  grpHdr.ele('CtrlSum').txt(amount);
  grpHdr.ele('InitgPty').ele('Nm').txt(debtorName);

  const pmtInf = cstmr.ele('PmtInf');
  pmtInf.ele('PmtInfId').txt(`PMT-${messageId.slice(0, 8)}`);
  pmtInf.ele('PmtMtd').txt('TRF');

  const pmtTpInf = pmtInf.ele('PmtTpInf');
  if (svcLvlCode) pmtTpInf.ele('SvcLvl').ele('Cd').txt(svcLvlCode);
  if (lclInstrmCode) pmtTpInf.ele('LclInstrm').ele('Cd').txt(lclInstrmCode);

  pmtInf.ele('ReqdExctnDt').ele('Dt').txt(isoDate(payment.Data.CreationDateTime));

  const dbtr = pmtInf.ele('Dbtr');
  dbtr.ele('Nm').txt(debtorName);
  if (initiation.CreditorPostalAddress) {
    buildPostalAddress(dbtr, initiation.CreditorPostalAddress);
  }

  if (debtorIBAN) {
    pmtInf.ele('DbtrAcct').ele('Id').ele('IBAN').txt(debtorIBAN);
  }

  if (debtorBIC) {
    pmtInf.ele('DbtrAgt').ele('FinInstnId').ele('BICFI').txt(debtorBIC);
  }

  const cdtTrfTxInf = pmtInf.ele('CdtTrfTxInf');
  const pmtId = cdtTrfTxInf.ele('PmtId');
  pmtId.ele('InstrId').txt(initiation.InstructionIdentification);
  pmtId.ele('EndToEndId').txt(initiation.EndToEndIdentification);

  cdtTrfTxInf.ele('Amt').ele('InstdAmt', { Ccy: currency }).txt(amount);

  if (creditorBIC) {
    cdtTrfTxInf.ele('CdtrAgt').ele('FinInstnId').ele('BICFI').txt(creditorBIC);
  }

  cdtTrfTxInf.ele('Cdtr').ele('Nm').txt(creditorName);

  if (creditorIBAN || creditorBBAN) {
    const acctId = cdtTrfTxInf.ele('CdtrAcct').ele('Id');
    if (creditorIBAN) acctId.ele('IBAN').txt(creditorIBAN);
    else if (creditorBBAN) acctId.ele('Othr').ele('Id').txt(creditorBBAN);
  }

  if (purposeCode) {
    cdtTrfTxInf.ele('Purp').ele('Cd').txt(purposeCode);
  }

  if (remit.structured) {
    cdtTrfTxInf.ele('RmtInf').ele('Strd').ele('CdtrRefInf').ele('Ref').txt(remit.structured.creditorReference);
  } else if (remit.unstructured) {
    cdtTrfTxInf.ele('RmtInf').ele('Ustrd').txt(remit.unstructured);
  }

  const xmlDocument = doc.end({ prettyPrint: true });

  if (options.validateOutput) {
    const { warnings: valWarnings } = validateXML(xmlDocument, 'pain.001');
    warnings.push(...valWarnings);
  }

  // ── Tokenization extension ────────────────────────────────────────────────
  let tokenizationInstruction;
  if (mmfMeta) {
    tokenizationInstruction = generateTokenizationInstruction(
      mmfMeta,
      initiation.InstructedAmount.Amount,
      initiation.InstructedAmount.Currency,
      messageId
    );
  }

  return {
    messageType: 'pain.001',
    messageId,
    creationDateTime,
    xmlDocument,
    mappingWarnings: warnings,
    tokenizationInstruction,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPostalAddress(parent: any, address: NonNullable<OBDomesticPaymentRequest['Data']['Initiation']['CreditorPostalAddress']>): void {
  const pstlAdr = parent.ele('PstlAdr');
  if (address.AddressType) pstlAdr.ele('AdrTp').ele('Cd').txt(address.AddressType);
  if (address.StreetName) pstlAdr.ele('StrtNm').txt(address.StreetName);
  if (address.BuildingNumber) pstlAdr.ele('BldgNb').txt(address.BuildingNumber);
  if (address.PostCode) pstlAdr.ele('PstCd').txt(address.PostCode);
  if (address.TownName) pstlAdr.ele('TwnNm').txt(address.TownName);
  if (address.Country) pstlAdr.ele('Ctry').txt(address.Country);
}

export function translateFDXPayment(
  payment: FDXPaymentInitiation,
  options: TranslationOptions = {}
): ISO20022Result {
  const warnings: MappingWarning[] = [];
  const messageId = uuidv4();
  const creationDateTime = isoDateTime(payment.creationDateTime);

  if (!payment.creditorAccount.routingTransitNumber) {
    warnings.push({
      field: 'creditorAccount.routingTransitNumber',
      severity: 'WARNING',
      message: 'FDX creditor account missing routingTransitNumber. CdtrAgt/FinInstnId will be omitted.',
      isoPath: 'CdtTrfTxInf/CdtrAgt/FinInstnId/ClrSysMmbId',
    });
  }

  const currency = payment.paymentCurrency;
  if (currency !== 'USD') {
    warnings.push({
      field: 'paymentCurrency',
      severity: 'WARNING',
      message: `Cross-currency FDX payment (${currency}) not supported in v0.1. Mapping may be incomplete.`,
      isoPath: 'CdtTrfTxInf/Amt/InstdAmt/@Ccy',
    });
  }

  const lclInstrmCode = payment.sameDayFlag ? 'WIRE' : 'ACH';
  const { code: purposeCode, warning: purposeWarning } = mapPurposeCode(payment.purposeCode);
  if (purposeWarning) {
    warnings.push({ field: 'purposeCode', severity: 'WARNING', message: purposeWarning, isoPath: 'CdtTrfTxInf/Purp/Cd' });
  }

  const remit = generateRemittance(undefined, payment.remittanceInfo);
  const debtorName = payment.debtorName || 'UNKNOWN';
  const creditorName = payment.creditorName || 'UNKNOWN';

  const doc = create({ version: '1.0', encoding: 'UTF-8' });
  const document = doc.ele('Document', { xmlns: 'urn:iso:std:iso:20022:tech:xsd:pain.001.001.09' });
  const cstmr = document.ele('CstmrCdtTrfInitn');

  const grpHdr = cstmr.ele('GrpHdr');
  grpHdr.ele('MsgId').txt(messageId);
  grpHdr.ele('CreDtTm').txt(creationDateTime);
  grpHdr.ele('NbOfTxs').txt('1');
  grpHdr.ele('CtrlSum').txt(payment.paymentAmount);
  grpHdr.ele('InitgPty').ele('Nm').txt(debtorName);

  const pmtInf = cstmr.ele('PmtInf');
  pmtInf.ele('PmtInfId').txt(`FDX-${messageId.slice(0, 8)}`);
  pmtInf.ele('PmtMtd').txt('TRF');
  pmtInf.ele('PmtTpInf').ele('LclInstrm').ele('Cd').txt(lclInstrmCode);
  pmtInf.ele('ReqdExctnDt').ele('Dt').txt(isoDate(payment.creationDateTime));
  pmtInf.ele('Dbtr').ele('Nm').txt(debtorName);

  if (payment.debtorAccount?.accountId) {
    pmtInf.ele('DbtrAcct').ele('Id').ele('Othr').ele('Id').txt(payment.debtorAccount.accountId);
  }

  if (payment.debtorAccount?.routingTransitNumber) {
    const dbtrAgt = pmtInf.ele('DbtrAgt').ele('FinInstnId').ele('ClrSysMmbId');
    dbtrAgt.ele('ClrSysId').ele('Cd').txt('USABA');
    dbtrAgt.ele('MmbId').txt(payment.debtorAccount.routingTransitNumber);
  } else if (options.instructingAgentBIC) {
    pmtInf.ele('DbtrAgt').ele('FinInstnId').ele('BICFI').txt(options.instructingAgentBIC);
  }

  const cdtTrfTxInf = pmtInf.ele('CdtTrfTxInf');
  const pmtId = cdtTrfTxInf.ele('PmtId');
  pmtId.ele('InstrId').txt(payment.paymentId);
  pmtId.ele('EndToEndId').txt(payment.paymentId);

  cdtTrfTxInf.ele('Amt').ele('InstdAmt', { Ccy: currency }).txt(payment.paymentAmount);

  if (payment.creditorAccount.routingTransitNumber) {
    const cdtrAgt = cdtTrfTxInf.ele('CdtrAgt').ele('FinInstnId').ele('ClrSysMmbId');
    cdtrAgt.ele('ClrSysId').ele('Cd').txt('USABA');
    cdtrAgt.ele('MmbId').txt(payment.creditorAccount.routingTransitNumber);
  }

  cdtTrfTxInf.ele('Cdtr').ele('Nm').txt(creditorName);
  cdtTrfTxInf.ele('CdtrAcct').ele('Id').ele('Othr').ele('Id').txt(payment.creditorAccount.accountId);

  if (purposeCode) {
    cdtTrfTxInf.ele('Purp').ele('Cd').txt(purposeCode);
  }

  if (remit.unstructured) {
    cdtTrfTxInf.ele('RmtInf').ele('Ustrd').txt(remit.unstructured);
  }

  const xmlDocument = doc.end({ prettyPrint: true });

  if (options.validateOutput) {
    const { warnings: valWarnings } = validateXML(xmlDocument, 'pain.001');
    warnings.push(...valWarnings);
  }

  return {
    messageType: 'pain.001',
    messageId,
    creationDateTime,
    xmlDocument,
    mappingWarnings: warnings,
  };
}
