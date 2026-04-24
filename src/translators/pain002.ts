import { create } from 'xmlbuilder2';
import { v4 as uuidv4 } from 'uuid';
import { OBPaymentStatus, TranslationOptions, ISO20022Result, MappingWarning } from '../types';
import { validateXML } from '../validators/xmlValidator';

type OBStatus = OBPaymentStatus['Data']['Status'];

const OB_STATUS_TO_ISO: Record<OBStatus, string> = {
  Pending: 'PDNG',
  AcceptedSettlementInProcess: 'ACSP',
  AcceptedSettlementCompleted: 'ACSC',
  AcceptedCreditSettlementCompleted: 'ACCC',
  AcceptedWithoutPosting: 'ACWP',
  Rejected: 'RJCT',
};

function isoDateTime(dt?: string): string {
  return dt ? new Date(dt).toISOString() : new Date().toISOString();
}

export function translateOBPaymentStatus(
  status: OBPaymentStatus,
  originalMessageId: string,
  options: TranslationOptions = {}
): ISO20022Result {
  const warnings: MappingWarning[] = [];
  const messageId = uuidv4();
  const creationDateTime = isoDateTime(status.Data.StatusUpdateDateTime);
  const txSts = OB_STATUS_TO_ISO[status.Data.Status];

  if (!txSts) {
    warnings.push({
      field: 'Data.Status',
      severity: 'ERROR',
      message: `Unknown OB UK status code '${status.Data.Status}'. Cannot map to ISO 20022 TxSts.`,
      isoPath: 'TxInfAndSts/TxSts',
    });
  }

  const isRejected = status.Data.Status === 'Rejected';
  const rejectionReason = status.Data.StatusReason?.StatusReasonDescription;
  const rejectionCode = status.Data.StatusReason?.StatusReasonCode;

  const initiation = status.Data.Initiation;
  const originalPmtInfId = initiation
    ? `PMT-${originalMessageId.slice(0, 8)}`
    : originalMessageId;

  const originalEndToEndId = initiation?.EndToEndIdentification || status.Data.DomesticPaymentId;

  const doc = create({ version: '1.0', encoding: 'UTF-8' });
  const document = doc.ele('Document', { xmlns: 'urn:iso:std:iso:20022:tech:xsd:pain.002.001.11' });
  const cstmr = document.ele('CstmrPmtStsRpt');

  const grpHdr = cstmr.ele('GrpHdr');
  grpHdr.ele('MsgId').txt(messageId);
  grpHdr.ele('CreDtTm').txt(creationDateTime);
  grpHdr.ele('InitgPty').ele('Nm').txt('OpenBanking Gateway');

  const orgnlGrp = cstmr.ele('OrgnlGrpInfAndSts');
  orgnlGrp.ele('OrgnlMsgId').txt(originalMessageId);
  orgnlGrp.ele('OrgnlMsgNmId').txt('pain.001.001.09');
  orgnlGrp.ele('GrpSts').txt(txSts || 'PDNG');

  const orgnlPmt = cstmr.ele('OrgnlPmtInfAndSts');
  orgnlPmt.ele('OrgnlPmtInfId').txt(originalPmtInfId);
  orgnlPmt.ele('PmtInfSts').txt(txSts || 'PDNG');

  const txInfAndSts = orgnlPmt.ele('TxInfAndSts');
  txInfAndSts.ele('OrgnlInstrId').txt(initiation?.InstructionIdentification || status.Data.DomesticPaymentId);
  txInfAndSts.ele('OrgnlEndToEndId').txt(originalEndToEndId);
  txInfAndSts.ele('TxSts').txt(txSts || 'PDNG');

  if (isRejected) {
    const stsRsnInf = txInfAndSts.ele('StsRsnInf');
    if (rejectionCode) {
      stsRsnInf.ele('Rsn').ele('Cd').txt(rejectionCode);
    } else {
      stsRsnInf.ele('Rsn').ele('Cd').txt('NARR');
    }
    if (rejectionReason) {
      stsRsnInf.ele('AddtlInf').txt(rejectionReason);
    }
  }

  if (initiation?.InstructedAmount) {
    txInfAndSts.ele('OrgnlTxRef')
      .ele('Amt')
        .ele('InstdAmt', { Ccy: initiation.InstructedAmount.Currency })
          .txt(initiation.InstructedAmount.Amount);
  }

  const xmlDocument = doc.end({ prettyPrint: true });

  if (options.validateOutput) {
    const { warnings: valWarnings } = validateXML(xmlDocument, 'pain.002');
    warnings.push(...valWarnings);
  }

  return {
    messageType: 'pain.002',
    messageId,
    creationDateTime,
    xmlDocument,
    mappingWarnings: warnings,
  };
}
