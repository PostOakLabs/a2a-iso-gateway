/**
 * Example: translate an Open Banking UK domestic payment into pain.001
 */
import { translateOBDomesticPayment, OBDomesticPaymentRequest } from '../src';

const payment: OBDomesticPaymentRequest = {
  Data: {
    Initiation: {
      InstructionIdentification: 'INSTR-2026-001',
      EndToEndIdentification: 'E2E-2026-001',
      InstructedAmount: { Amount: '1500.00', Currency: 'GBP' },
      DebtorAccount: {
        SchemeName: 'UK.OBIE.IBAN',
        Identification: 'GB29NWBK60161331926819',
        Name: 'John Smith',
      },
      CreditorAccount: {
        SchemeName: 'UK.OBIE.SortCodeAccountNumber',
        Identification: '20-00-00/55779911',
        Name: 'Jane Doe',
      },
      RemittanceInformation: { Reference: 'INV-2026-042' },
    },
    DebtorName: 'John Smith',
    CreationDateTime: new Date().toISOString(),
  },
  Risk: { PaymentContextCode: 'PartyToParty' },
};

const result = translateOBDomesticPayment(payment, {
  convertSortCodeToIBAN: true,
  validateOutput: true,
});

console.log('Message type:', result.messageType);
console.log('Message ID:', result.messageId);
console.log('Warnings:', result.mappingWarnings);
console.log('\n--- ISO 20022 XML ---');
console.log(result.xmlDocument);
