import { create } from 'xmlbuilder2';
import { v4 as uuidv4 } from 'uuid';
import { A2ACreditNotification, TranslationOptions, ISO20022Result, MappingWarning } from '../types';
import { validateXML } from '../validators/xmlValidator';

function isoDateTime(dt?: string): string {
  return dt ? new Date(dt).toISOString() : new Date().toISOString();
}

function isoDate(dt?: string): string {
  return (dt ? new Date(dt) : new Date()).toISOString().split('T')[0];
}

export function translateA2ACreditNotification(
  notification: A2ACreditNotification,
  options: TranslationOptions = {}
): ISO20022Result {
  const warnings: MappingWarning[] = [];
  const messageId = notification.messageId || uuidv4();
  const creationDateTime = isoDateTime(notification.creationDateTime);
  const bookingDate = isoDate(notification.bookingDate);
  const valueDate = isoDate(notification.valueDate);

  const doc = create({ version: '1.0', encoding: 'UTF-8' });
  const document = doc.ele('Document', { xmlns: 'urn:iso:std:iso:20022:tech:xsd:camt.054.001.09' });
  const bkToCstmr = document.ele('BkToCstmrDbtCdtNtfctn');

  const grpHdr = bkToCstmr.ele('GrpHdr');
  grpHdr.ele('MsgId').txt(messageId);
  grpHdr.ele('CreDtTm').txt(creationDateTime);
  if (notification.recipientName) {
    grpHdr.ele('MsgRcpt').ele('Nm').txt(notification.recipientName);
  }

  const ntfctn = bkToCstmr.ele('Ntfctn');
  ntfctn.ele('Id').txt(notification.notificationId);

  // Account identification
  const acctId = notification.recipientAccount;
  const acct = ntfctn.ele('Acct').ele('Id');
  if (acctId.iban) {
    acct.ele('IBAN').txt(acctId.iban);
  } else if (acctId.bban || acctId.accountId) {
    acct.ele('Othr').ele('Id').txt(acctId.bban || acctId.accountId!);
  } else {
    warnings.push({
      field: 'recipientAccount',
      severity: 'WARNING',
      message: 'No valid account identifier (IBAN or BBAN) found for recipient account.',
      isoPath: 'Ntfctn/Acct/Id',
    });
  }

  // Entry (credit notification)
  const ntry = ntfctn.ele('Ntry');
  ntry.ele('Amt', { Ccy: notification.currency }).txt(notification.amount);
  ntry.ele('CdtDbtInd').txt('CRDT');
  ntry.ele('Sts').ele('Cd').txt(notification.status);
  ntry.ele('BookgDt').ele('Dt').txt(bookingDate);
  ntry.ele('ValDt').ele('Dt').txt(valueDate);

  // Transaction details
  const txDtls = ntry.ele('NtryDtls').ele('TxDtls');
  const refs = txDtls.ele('Refs');
  if (notification.endToEndId) refs.ele('EndToEndId').txt(notification.endToEndId);
  if (notification.instructionId) refs.ele('InstrId').txt(notification.instructionId);

  if (notification.debtorName) {
    txDtls.ele('RltdPties').ele('Dbtr').ele('Pty').ele('Nm').txt(notification.debtorName);
  }

  if (notification.remittanceInfo) {
    txDtls.ele('RmtInf').ele('Ustrd').txt(notification.remittanceInfo);
  }

  const xmlDocument = doc.end({ prettyPrint: true });

  if (options.validateOutput) {
    const { warnings: valWarnings } = validateXML(xmlDocument, 'camt.054');
    warnings.push(...valWarnings);
  }

  return {
    messageType: 'camt.054',
    messageId,
    creationDateTime,
    xmlDocument,
    mappingWarnings: warnings,
  };
}
