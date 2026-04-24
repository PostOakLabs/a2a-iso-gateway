import { create } from 'xmlbuilder2';
import { v4 as uuidv4 } from 'uuid';
import {
  SettlementConfirmation,
  FDXPaymentConfirmation,
  TranslationOptions,
  ISO20022Result,
  MappingWarning,
} from '../types';
import { mapPurposeCode } from '../enrichment/purposeCodes';
import { validateXML } from '../validators/xmlValidator';

function isoDateTime(dt?: string): string {
  return dt ? new Date(dt).toISOString() : new Date().toISOString();
}

function isoDate(dt?: string): string {
  return (dt ? new Date(dt) : new Date()).toISOString().split('T')[0];
}

export function translateSettlementConfirmation(
  confirmation: SettlementConfirmation,
  options: TranslationOptions = {}
): ISO20022Result {
  const warnings: MappingWarning[] = [];
  const messageId = confirmation.messageId || uuidv4();
  const creationDateTime = isoDateTime(confirmation.creationDateTime);
  const chargeBearer = confirmation.chargeBearer || 'SLEV';

  const { code: purposeCode, warning: purposeWarning } = mapPurposeCode(confirmation.purposeCode);
  if (purposeWarning) {
    warnings.push({ field: 'purposeCode', severity: 'WARNING', message: purposeWarning, isoPath: 'CdtTrfTxInf/Purp/Cd' });
  }

  const doc = create({ version: '1.0', encoding: 'UTF-8' });
  const document = doc.ele('Document', { xmlns: 'urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10' });
  const fiToFi = document.ele('FIToFICstmrCdtTrf');

  const grpHdr = fiToFi.ele('GrpHdr');
  grpHdr.ele('MsgId').txt(messageId);
  grpHdr.ele('CreDtTm').txt(creationDateTime);
  grpHdr.ele('NbOfTxs').txt('1');
  grpHdr.ele('SttlmInf').ele('SttlmMtd').txt('INDA');

  const cdtTrfTxInf = fiToFi.ele('CdtTrfTxInf');
  const pmtId = cdtTrfTxInf.ele('PmtId');
  pmtId.ele('InstrId').txt(confirmation.instructionId);
  pmtId.ele('EndToEndId').txt(confirmation.endToEndId);

  cdtTrfTxInf.ele('IntrBkSttlmAmt', { Ccy: confirmation.settlementCurrency }).txt(confirmation.settlementAmount);
  cdtTrfTxInf.ele('IntrBkSttlmDt').txt(isoDate(confirmation.settlementDate));
  cdtTrfTxInf.ele('ChrgBr').txt(chargeBearer);

  cdtTrfTxInf.ele('DbtrAgt').ele('FinInstnId').ele('BICFI').txt(confirmation.debtorAgentBIC);

  if (confirmation.debtorName) {
    cdtTrfTxInf.ele('Dbtr').ele('Nm').txt(confirmation.debtorName);
  }

  if (confirmation.debtorAccount?.iban || confirmation.debtorAccount?.bban) {
    const acctId = cdtTrfTxInf.ele('DbtrAcct').ele('Id');
    if (confirmation.debtorAccount.iban) acctId.ele('IBAN').txt(confirmation.debtorAccount.iban);
    else if (confirmation.debtorAccount.bban) acctId.ele('Othr').ele('Id').txt(confirmation.debtorAccount.bban);
  }

  cdtTrfTxInf.ele('CdtrAgt').ele('FinInstnId').ele('BICFI').txt(confirmation.creditorAgentBIC);

  if (confirmation.creditorName) {
    cdtTrfTxInf.ele('Cdtr').ele('Nm').txt(confirmation.creditorName);
  }

  if (confirmation.creditorAccount?.iban || confirmation.creditorAccount?.bban) {
    const acctId = cdtTrfTxInf.ele('CdtrAcct').ele('Id');
    if (confirmation.creditorAccount.iban) acctId.ele('IBAN').txt(confirmation.creditorAccount.iban);
    else if (confirmation.creditorAccount.bban) acctId.ele('Othr').ele('Id').txt(confirmation.creditorAccount.bban);
  }

  if (purposeCode) {
    cdtTrfTxInf.ele('Purp').ele('Cd').txt(purposeCode);
  }

  const xmlDocument = doc.end({ prettyPrint: true });

  if (options.validateOutput) {
    const { warnings: valWarnings } = validateXML(xmlDocument, 'pacs.008');
    warnings.push(...valWarnings);
  }

  return {
    messageType: 'pacs.008',
    messageId,
    creationDateTime,
    xmlDocument,
    mappingWarnings: warnings,
  };
}

export function translateFDXConfirmation(
  confirmation: FDXPaymentConfirmation,
  originalMessageId: string,
  options: TranslationOptions = {}
): ISO20022Result {
  const warnings: MappingWarning[] = [];
  const messageId = uuidv4();
  const creationDateTime = isoDateTime(confirmation.confirmationDateTime);
  const chargeBearer = confirmation.chargeBearer || 'SLEV';

  if (confirmation.status === 'FAILED' || confirmation.status === 'CANCELLED') {
    warnings.push({
      field: 'status',
      severity: 'WARNING',
      message: `FDX confirmation status is ${confirmation.status}. Generating pacs.008 with original IDs. Consider generating pain.002 for failed/cancelled status.`,
      isoPath: 'CdtTrfTxInf',
    });
  }

  const debtorRoutingNumber = confirmation.debtorAgent?.routingNumber;
  const creditorRoutingNumber = confirmation.creditorAgent?.routingNumber;

  if (!debtorRoutingNumber) {
    warnings.push({
      field: 'debtorAgent.routingNumber',
      severity: 'ERROR',
      message: 'pacs.008 requires debtorAgentBIC or routing number. Field missing.',
      isoPath: 'CdtTrfTxInf/DbtrAgt/FinInstnId',
    });
  }

  if (!creditorRoutingNumber) {
    warnings.push({
      field: 'creditorAgent.routingNumber',
      severity: 'ERROR',
      message: 'pacs.008 requires creditorAgentBIC or routing number. Field missing.',
      isoPath: 'CdtTrfTxInf/CdtrAgt/FinInstnId',
    });
  }

  const doc = create({ version: '1.0', encoding: 'UTF-8' });
  const document = doc.ele('Document', { xmlns: 'urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10' });
  const fiToFi = document.ele('FIToFICstmrCdtTrf');

  const grpHdr = fiToFi.ele('GrpHdr');
  grpHdr.ele('MsgId').txt(messageId);
  grpHdr.ele('CreDtTm').txt(creationDateTime);
  grpHdr.ele('NbOfTxs').txt('1');
  grpHdr.ele('SttlmInf').ele('SttlmMtd').txt('INDA');

  const cdtTrfTxInf = fiToFi.ele('CdtTrfTxInf');
  const pmtId = cdtTrfTxInf.ele('PmtId');
  pmtId.ele('InstrId').txt(confirmation.paymentId);
  pmtId.ele('EndToEndId').txt(confirmation.originalPaymentId);

  cdtTrfTxInf.ele('IntrBkSttlmAmt', { Ccy: confirmation.settlementCurrency }).txt(confirmation.settlementAmount);
  cdtTrfTxInf.ele('IntrBkSttlmDt').txt(isoDate(confirmation.settlementDate));
  cdtTrfTxInf.ele('ChrgBr').txt(chargeBearer);

  if (debtorRoutingNumber) {
    const dbtrAgt = cdtTrfTxInf.ele('DbtrAgt').ele('FinInstnId').ele('ClrSysMmbId');
    dbtrAgt.ele('ClrSysId').ele('Cd').txt('USABA');
    dbtrAgt.ele('MmbId').txt(debtorRoutingNumber);
  } else if (options.instructingAgentBIC) {
    cdtTrfTxInf.ele('DbtrAgt').ele('FinInstnId').ele('BICFI').txt(options.instructingAgentBIC);
  }

  if (creditorRoutingNumber) {
    const cdtrAgt = cdtTrfTxInf.ele('CdtrAgt').ele('FinInstnId').ele('ClrSysMmbId');
    cdtrAgt.ele('ClrSysId').ele('Cd').txt('USABA');
    cdtrAgt.ele('MmbId').txt(creditorRoutingNumber);
  } else if (options.instructedAgentBIC) {
    cdtTrfTxInf.ele('CdtrAgt').ele('FinInstnId').ele('BICFI').txt(options.instructedAgentBIC);
  }

  // Reference originalMessageId in a remark (not a standard ISO field, but useful for tracing)
  void originalMessageId;

  const xmlDocument = doc.end({ prettyPrint: true });

  if (options.validateOutput) {
    const { warnings: valWarnings } = validateXML(xmlDocument, 'pacs.008');
    warnings.push(...valWarnings);
  }

  return {
    messageType: 'pacs.008',
    messageId,
    creationDateTime,
    xmlDocument,
    mappingWarnings: warnings,
  };
}
