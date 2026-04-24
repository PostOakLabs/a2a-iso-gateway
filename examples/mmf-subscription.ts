/**
 * Example: OB payment with Tokenized MMF metadata (POL extension)
 * Produces pain.001 with Purp/Cd=SECU + a TokenizationInstruction
 */
import { translateOBDomesticPayment, OBDomesticPaymentRequest } from '../src';

const payment: OBDomesticPaymentRequest = {
  Data: {
    Initiation: {
      InstructionIdentification: 'MMF-2026-001',
      EndToEndIdentification: 'MMF-E2E-001',
      InstructedAmount: { Amount: '50000.00', Currency: 'GBP' },
      CreditorAccount: {
        SchemeName: 'UK.OBIE.IBAN',
        Identification: 'GB29NWBK60161331926819',
        Name: 'MMF Custodian Bank',
      },
      SupplementaryData: {
        TokenizedMMFMetadata: {
          fundIdentifier: 'GB00B3FLYX16',
          fundName: 'GBP Sterling Money Market Fund',
          onChainWalletAddress: '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12',
          blockchainNetwork: 'ethereum',
        },
      },
    },
    DebtorName: 'Institutional Investor A',
    CreationDateTime: new Date().toISOString(),
  },
  Risk: {},
};

const result = translateOBDomesticPayment(payment);

console.log('Message type:', result.messageType);
console.log('Message ID:', result.messageId);
console.log('\nTokenization Instruction:');
console.log(JSON.stringify(result.tokenizationInstruction, null, 2));
console.log('\nMapping Warnings:');
result.mappingWarnings.forEach((w) =>
  console.log(`  [${w.severity}] ${w.field}: ${w.message}`)
);
console.log('\n--- ISO 20022 XML ---');
console.log(result.xmlDocument);
