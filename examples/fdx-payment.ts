/**
 * Example: translate a US FDX payment initiation into pain.001
 */
import { translateFDXPayment, FDXPaymentInitiation } from '../src';

const payment: FDXPaymentInitiation = {
  paymentId: 'FDX-2026-001',
  paymentAmount: '25000.00',
  paymentCurrency: 'USD',
  debtorAccount: {
    accountId: '123456789',
    routingTransitNumber: '021000021',
    accountType: 'CHECKING',
  },
  creditorAccount: {
    accountId: '987654321',
    routingTransitNumber: '026009593',
    accountType: 'CHECKING',
  },
  creditorName: 'ACME Corp',
  debtorName: 'John Doe',
  remittanceInfo: 'Q2 vendor payment',
  creationDateTime: new Date().toISOString(),
};

const result = translateFDXPayment(payment);

console.log('Message type:', result.messageType);
console.log('Message ID:', result.messageId);
console.log('Warnings:', result.mappingWarnings);
console.log('\n--- ISO 20022 XML ---');
console.log(result.xmlDocument);
