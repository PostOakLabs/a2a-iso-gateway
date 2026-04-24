import { translateOBDomesticPayment, translateFDXPayment } from '../../src/translators/pain001';
import { translateOBPaymentStatus } from '../../src/translators/pain002';
import { translateSettlementConfirmation } from '../../src/translators/pacs008';
import { translateA2ACreditNotification } from '../../src/translators/camt054';
import {
  OBDomesticPaymentRequest,
  OBPaymentStatus,
  SettlementConfirmation,
  A2ACreditNotification,
  FDXPaymentInitiation,
} from '../../src/types';

const standardOBPayment: OBDomesticPaymentRequest = {
  Data: {
    Initiation: {
      InstructionIdentification: 'INSTR-001',
      EndToEndIdentification: 'E2E-001',
      InstructedAmount: { Amount: '100.00', Currency: 'GBP' },
      DebtorAccount: {
        SchemeName: 'UK.OBIE.IBAN',
        Identification: 'GB29NWBK60161331926819',
        Name: 'John Smith',
      },
      CreditorAccount: {
        SchemeName: 'UK.OBIE.IBAN',
        Identification: 'GB82WEST12345698765432',
        Name: 'Jane Doe',
      },
      RemittanceInformation: { Reference: 'INV-12345' },
    },
    DebtorName: 'John Smith',
    CreationDateTime: '2026-04-15T10:30:00Z',
  },
  Risk: {},
};

describe('translateOBDomesticPayment', () => {
  test('returns pain.001 message type', () => {
    const result = translateOBDomesticPayment(standardOBPayment);
    expect(result.messageType).toBe('pain.001');
  });

  test('generates valid XML with ISO namespace', () => {
    const result = translateOBDomesticPayment(standardOBPayment);
    expect(result.xmlDocument).toContain('urn:iso:std:iso:20022:tech:xsd:pain.001.001.09');
    expect(result.xmlDocument).toContain('<CstmrCdtTrfInitn>');
    expect(result.xmlDocument).toContain('<GrpHdr>');
    expect(result.xmlDocument).toContain('<PmtInf>');
  });

  test('preserves amount as string, not floating point', () => {
    const result = translateOBDomesticPayment(standardOBPayment);
    expect(result.xmlDocument).toContain('100.00');
    expect(result.xmlDocument).not.toContain('100.00000001');
  });

  test('includes end-to-end ID', () => {
    const result = translateOBDomesticPayment(standardOBPayment);
    expect(result.xmlDocument).toContain('E2E-001');
  });

  test('uses direct IBAN when provided', () => {
    const result = translateOBDomesticPayment(standardOBPayment);
    expect(result.xmlDocument).toContain('GB82WEST12345698765432');
  });

  test('generates structured remittance for INV- reference', () => {
    const result = translateOBDomesticPayment(standardOBPayment);
    expect(result.xmlDocument).toContain('<Strd>');
    expect(result.xmlDocument).toContain('INV-12345');
  });

  test('emits no warnings for clean IBAN payment', () => {
    const result = translateOBDomesticPayment(standardOBPayment);
    const errors = result.mappingWarnings.filter((w) => w.severity === 'ERROR');
    expect(errors).toHaveLength(0);
  });

  test('converts sort code account number to pseudo-IBAN', () => {
    const payment: OBDomesticPaymentRequest = {
      ...standardOBPayment,
      Data: {
        ...standardOBPayment.Data,
        Initiation: {
          ...standardOBPayment.Data.Initiation,
          CreditorAccount: {
            SchemeName: 'UK.OBIE.SortCodeAccountNumber',
            Identification: '20-00-00/55779911',
            Name: 'Sort Code Payee',
          },
        },
      },
    };
    const result = translateOBDomesticPayment(payment);
    // Should contain a pseudo-IBAN starting with GB
    expect(result.xmlDocument).toMatch(/GB\d{2}NWBK/);
    // Should warn about pseudo-IBAN
    const pseudoWarning = result.mappingWarnings.find((w) =>
      w.message.includes('pseudo-IBAN')
    );
    expect(pseudoWarning).toBeDefined();
  });

  test('emits ERROR warning for PAN scheme', () => {
    const payment: OBDomesticPaymentRequest = {
      ...standardOBPayment,
      Data: {
        ...standardOBPayment.Data,
        Initiation: {
          ...standardOBPayment.Data.Initiation,
          CreditorAccount: {
            SchemeName: 'UK.OBIE.PAN',
            Identification: '4111111111111111',
            Name: 'Card',
          },
        },
      },
    };
    const result = translateOBDomesticPayment(payment);
    const panError = result.mappingWarnings.find(
      (w) => w.severity === 'ERROR' && w.message.includes('PAN')
    );
    expect(panError).toBeDefined();
  });

  test('emits INFO warning for missing debtor account', () => {
    const payment: OBDomesticPaymentRequest = {
      ...standardOBPayment,
      Data: {
        ...standardOBPayment.Data,
        Initiation: {
          ...standardOBPayment.Data.Initiation,
          DebtorAccount: undefined,
        },
      },
    };
    const result = translateOBDomesticPayment(payment);
    const anonWarning = result.mappingWarnings.find(
      (w) => w.severity === 'INFO' && w.field === 'debtorAccount'
    );
    expect(anonWarning).toBeDefined();
  });

  test('generates tokenization instruction when MMF metadata present', () => {
    const payment: OBDomesticPaymentRequest = {
      ...standardOBPayment,
      Data: {
        ...standardOBPayment.Data,
        Initiation: {
          ...standardOBPayment.Data.Initiation,
          SupplementaryData: {
            TokenizedMMFMetadata: {
              fundIdentifier: 'GB00B3FLYX16',
              onChainWalletAddress: '0xABCD',
              blockchainNetwork: 'ethereum',
            },
          },
        },
      },
    };
    const result = translateOBDomesticPayment(payment);
    expect(result.tokenizationInstruction).toBeDefined();
    expect(result.tokenizationInstruction?.fundIdentifier).toBe('GB00B3FLYX16');
    expect(result.tokenizationInstruction?.linkedISO20022MessageId).toBe(result.messageId);
  });

  test('GBP currency uses FASTER local instrument', () => {
    const result = translateOBDomesticPayment(standardOBPayment);
    expect(result.xmlDocument).toContain('<Cd>FASTER</Cd>');
  });

  test('EUR currency uses SEPA service level', () => {
    const payment: OBDomesticPaymentRequest = {
      ...standardOBPayment,
      Data: {
        ...standardOBPayment.Data,
        Initiation: {
          ...standardOBPayment.Data.Initiation,
          InstructedAmount: { Amount: '100.00', Currency: 'EUR' },
        },
      },
    };
    const result = translateOBDomesticPayment(payment);
    expect(result.xmlDocument).toContain('<Cd>SEPA</Cd>');
  });
});

describe('translateOBPaymentStatus', () => {
  const makeStatus = (status: OBPaymentStatus['Data']['Status']): OBPaymentStatus => ({
    Data: {
      DomesticPaymentId: 'PAY-001',
      Status: status,
      StatusUpdateDateTime: '2026-04-15T10:35:00Z',
      CreationDateTime: '2026-04-15T10:30:00Z',
    },
  });

  test('returns pain.002 message type', () => {
    const result = translateOBPaymentStatus(makeStatus('Pending'), 'msg-001');
    expect(result.messageType).toBe('pain.002');
  });

  test('maps Pending to PDNG', () => {
    const result = translateOBPaymentStatus(makeStatus('Pending'), 'msg-001');
    expect(result.xmlDocument).toContain('<TxSts>PDNG</TxSts>');
  });

  test('maps AcceptedSettlementCompleted to ACSC', () => {
    const result = translateOBPaymentStatus(makeStatus('AcceptedSettlementCompleted'), 'msg-001');
    expect(result.xmlDocument).toContain('<TxSts>ACSC</TxSts>');
  });

  test('maps Rejected to RJCT with reason', () => {
    const status: OBPaymentStatus = {
      Data: {
        DomesticPaymentId: 'PAY-003',
        Status: 'Rejected',
        StatusUpdateDateTime: '2026-04-15T10:32:00Z',
        CreationDateTime: '2026-04-15T10:30:00Z',
        StatusReason: {
          StatusReasonCode: 'AM04',
          StatusReasonDescription: 'InsufficientFunds',
        },
      },
    };
    const result = translateOBPaymentStatus(status, 'msg-003');
    expect(result.xmlDocument).toContain('<TxSts>RJCT</TxSts>');
    expect(result.xmlDocument).toContain('AM04');
    expect(result.xmlDocument).toContain('InsufficientFunds');
  });

  test('references original message ID', () => {
    const result = translateOBPaymentStatus(makeStatus('AcceptedSettlementInProcess'), 'original-msg-id-123');
    expect(result.xmlDocument).toContain('original-msg-id-123');
  });
});

describe('translateSettlementConfirmation (pacs.008)', () => {
  const confirmation: SettlementConfirmation = {
    messageId: 'PACS-001',
    originalMessageId: 'msg-001',
    settlementAmount: '100.00',
    settlementCurrency: 'GBP',
    settlementDate: '2026-04-15',
    instructionId: 'INSTR-001',
    endToEndId: 'E2E-001',
    debtorAgentBIC: 'NWBKGB2L',
    creditorAgentBIC: 'BAGLGB22',
    chargeBearer: 'SLEV',
  };

  test('returns pacs.008 message type', () => {
    const result = translateSettlementConfirmation(confirmation);
    expect(result.messageType).toBe('pacs.008');
  });

  test('generates FIToFICstmrCdtTrf root element', () => {
    const result = translateSettlementConfirmation(confirmation);
    expect(result.xmlDocument).toContain('<FIToFICstmrCdtTrf>');
  });

  test('includes both debtor and creditor agent BICs', () => {
    const result = translateSettlementConfirmation(confirmation);
    expect(result.xmlDocument).toContain('NWBKGB2L');
    expect(result.xmlDocument).toContain('BAGLGB22');
  });

  test('uses IntrBkSttlmAmt instead of InstdAmt', () => {
    const result = translateSettlementConfirmation(confirmation);
    expect(result.xmlDocument).toContain('<IntrBkSttlmAmt');
    expect(result.xmlDocument).not.toContain('<InstdAmt');
  });

  test('includes charge bearer', () => {
    const result = translateSettlementConfirmation(confirmation);
    expect(result.xmlDocument).toContain('<ChrgBr>SLEV</ChrgBr>');
  });
});

describe('translateA2ACreditNotification (camt.054)', () => {
  const notification: A2ACreditNotification = {
    notificationId: 'NTFCTN-001',
    creationDateTime: '2026-04-15T11:00:00Z',
    recipientName: 'John Smith',
    recipientAccount: { iban: 'GB29NWBK60161331926819' },
    amount: '100.00',
    currency: 'GBP',
    bookingDate: '2026-04-15',
    valueDate: '2026-04-15',
    status: 'BOOK',
    endToEndId: 'E2E-001',
    debtorName: 'Jane Doe',
  };

  test('returns camt.054 message type', () => {
    const result = translateA2ACreditNotification(notification);
    expect(result.messageType).toBe('camt.054');
  });

  test('generates BkToCstmrDbtCdtNtfctn root element', () => {
    const result = translateA2ACreditNotification(notification);
    expect(result.xmlDocument).toContain('<BkToCstmrDbtCdtNtfctn>');
  });

  test('includes CRDT indicator', () => {
    const result = translateA2ACreditNotification(notification);
    expect(result.xmlDocument).toContain('<CdtDbtInd>CRDT</CdtDbtInd>');
  });

  test('includes BOOK status for booked entry', () => {
    const result = translateA2ACreditNotification(notification);
    expect(result.xmlDocument).toContain('<Cd>BOOK</Cd>');
  });

  test('includes PDNG status for pending entry', () => {
    const pendingNotif: A2ACreditNotification = { ...notification, status: 'PDNG' };
    const result = translateA2ACreditNotification(pendingNotif);
    expect(result.xmlDocument).toContain('<Cd>PDNG</Cd>');
  });

  test('warns when no valid account ID', () => {
    const notif: A2ACreditNotification = { ...notification, recipientAccount: {} };
    const result = translateA2ACreditNotification(notif);
    const w = result.mappingWarnings.find((w) => w.field === 'recipientAccount');
    expect(w).toBeDefined();
    expect(w?.severity).toBe('WARNING');
  });
});

describe('translateFDXPayment', () => {
  const fdxPayment: FDXPaymentInitiation = {
    paymentId: 'FDX-001',
    paymentAmount: '500.00',
    paymentCurrency: 'USD',
    debtorAccount: { accountId: '123456789', routingTransitNumber: '021000021' },
    creditorAccount: { accountId: '987654321', routingTransitNumber: '011000138' },
    creditorName: 'ACME Corp',
    debtorName: 'John Doe',
    creationDateTime: '2026-04-15T15:00:00Z',
  };

  test('returns pain.001 message type', () => {
    const result = translateFDXPayment(fdxPayment);
    expect(result.messageType).toBe('pain.001');
  });

  test('uses USABA clearing system for ABA routing numbers', () => {
    const result = translateFDXPayment(fdxPayment);
    expect(result.xmlDocument).toContain('USABA');
    expect(result.xmlDocument).toContain('021000021');
  });

  test('uses ACH local instrument for standard payment', () => {
    const result = translateFDXPayment(fdxPayment);
    expect(result.xmlDocument).toContain('<Cd>ACH</Cd>');
  });

  test('uses WIRE local instrument for same-day payment', () => {
    const sameDay: FDXPaymentInitiation = { ...fdxPayment, sameDayFlag: true };
    const result = translateFDXPayment(sameDay);
    expect(result.xmlDocument).toContain('<Cd>WIRE</Cd>');
  });

  test('warns when creditor routing number missing', () => {
    const noRouting: FDXPaymentInitiation = {
      ...fdxPayment,
      creditorAccount: { accountId: '999' },
    };
    const result = translateFDXPayment(noRouting);
    const w = result.mappingWarnings.find(
      (w) => w.field === 'creditorAccount.routingTransitNumber'
    );
    expect(w).toBeDefined();
  });
});
