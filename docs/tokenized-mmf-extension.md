# Tokenized MMF Extension

This document describes the `TokenizedMMFMetadata` extension that links `a2a-iso-gateway` to POL Opportunity 1 (`iso20022-token-bridge`).

## Overview

When a payment carries `TokenizedMMFMetadata` in `SupplementaryData`, the gateway:

1. Sets `Purp/Cd = SECU` in the generated pain.001
2. Emits a WARNING noting the TMMF→SECU mapping
3. Generates a `TokenizationInstruction` alongside the ISO 20022 message

## TokenizationInstruction Shape

```typescript
interface TokenizationInstruction {
  instructionId: string;           // generated UUID
  fundIdentifier: string;          // ISIN or fund code
  subscriptionAmount: string;      // from payment amount (string, not float)
  currency: string;
  investorWalletAddress?: string;  // on-chain destination
  blockchainNetwork?: string;      // "ethereum" | "xrpl" | "stellar"
  linkedISO20022MessageId: string; // MsgId of the pain.001
}
```

## Usage

```typescript
import { translateOBDomesticPayment } from 'a2a-iso-gateway';

const result = translateOBDomesticPayment({
  Data: {
    Initiation: {
      // ... standard payment fields ...
      SupplementaryData: {
        TokenizedMMFMetadata: {
          fundIdentifier: 'GB00B3FLYX16',
          fundName: 'GBP Money Market Fund',
          onChainWalletAddress: '0xAbCd1234',
          blockchainNetwork: 'ethereum',
        },
      },
    },
  },
  Risk: {},
});

// pain.001 XML with Purp/Cd=SECU
console.log(result.xmlDocument);

// Tokenization instruction for the token bridge
console.log(result.tokenizationInstruction);
```

## Integration with iso20022-token-bridge (Opportunity 1)

When `iso20022-token-bridge` is available, replace the stub in `src/tokenization/mmfExtension.ts`:

```typescript
// Before (stub)
import { generateTokenizationInstruction } from 'a2a-iso-gateway/tokenization';

// After (real integration)
import { generateTokenizationInstruction } from 'iso20022-token-bridge';
```

The `linkedISO20022MessageId` field allows the token bridge to correlate the on-chain instruction with the ISO 20022 payment record for audit and reconciliation purposes.
