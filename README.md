# a2a-iso-gateway

[![npm version](https://img.shields.io/npm/v/a2a-iso-gateway)](https://www.npmjs.com/package/a2a-iso-gateway)
[![CI](https://github.com/PostOakLabs/a2a-iso-gateway/actions/workflows/ci.yml/badge.svg)](https://github.com/PostOakLabs/a2a-iso-gateway/actions)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

Translate Open Banking A2A payment events into ISO 20022 MX messages. Bridges OBIE v3.1 and FDX JSON payloads to `pain.001`, `pacs.008`, `pain.002`, and `camt.054` — with sort code conversion, purpose code mapping, and structured remittance generation included.

```typescript
import { translateOBDomesticPayment } from 'a2a-iso-gateway';

const result = translateOBDomesticPayment({
  Data: {
    Initiation: {
      InstructionIdentification: 'INSTR-001',
      EndToEndIdentification: 'E2E-001',
      InstructedAmount: { Amount: '1500.00', Currency: 'GBP' },
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
  Risk: {},
});

console.log(result.xmlDocument); // → pain.001.001.09 XML
console.log(result.mappingWarnings); // → pseudo-IBAN warning
```

---

## The Problem

Platforms like TrueLayer, Token.io, and Tink generate A2A payments in Open Banking JSON. Their downstream consumers — core banking systems, central bank reporters, tokenized asset platforms — require ISO 20022. No open, auditable, testable gateway library exists. Fintechs build this in-house (expensive) or rely on opaque bank middleware (black box). This library fixes that.

---

## Installation

```bash
npm install a2a-iso-gateway
```

Node.js 20+ required.

---

## Quick Start

```typescript
import { translateOBDomesticPayment } from 'a2a-iso-gateway';

const result = translateOBDomesticPayment(payment, {
  convertSortCodeToIBAN: true,  // default: true
  validateOutput: true,          // validate generated XML
});
// result.messageType    → "pain.001"
// result.xmlDocument    → ISO 20022 XML string
// result.mappingWarnings → MappingWarning[]
```

---

## Supported Translations

| Input | Output | Function |
|---|---|---|
| `OBDomesticPaymentRequest` (OBIE v3.1) | `pain.001.001.09` | `translateOBDomesticPayment()` |
| `OBPaymentStatus` webhook | `pain.002.001.11` | `translateOBPaymentStatus()` |
| `FDXPaymentInitiation` (US FDX) | `pain.001.001.09` | `translateFDXPayment()` |
| `FDXPaymentConfirmation` / `SettlementConfirmation` | `pacs.008.001.10` | `translateFDXConfirmation()` / `translateSettlementConfirmation()` |
| `A2ACreditNotification` | `camt.054.001.09` | `translateA2ACreditNotification()` |

---

## Enrichment Features

### Sort Code → Pseudo-IBAN

UK sort code + account numbers are converted to structurally valid IBANs using ISO 13616 MOD-97. A `WARNING` is always emitted noting the result is a pseudo-IBAN, not a routable one.

```typescript
import { convertSortCodeToIBAN } from 'a2a-iso-gateway';

const { iban, warning } = convertSortCodeToIBAN('20-00-00', '55779911');
// iban → "GB29NWBK200000..."
```

### Purpose Code Mapping

All known OB UK purpose codes map to ISO 20022 `ExternalPurpose1Code`. Unknown codes fall back to `OTHR` with a warning.

```typescript
import { mapPurposeCode } from 'a2a-iso-gateway';

const { code, warning } = mapPurposeCode('SALA'); // → { code: 'SALA', warning: null }
const { code: othr } = mapPurposeCode('ZZZZ');    // → { code: 'OTHR', warning: '...' }
```

### Structured Remittance

References matching `INV-*`, `REF-*`, `SI*`, `PO-*` are mapped to `RmtInf/Strd/CdtrRefInf`. Everything else maps to `RmtInf/Ustrd`.

### BIC Lookup

Sort code prefix → BIC stub for major UK banks (Barclays, Lloyds, HSBC, NatWest, Santander, Monzo, Starling). Register overrides for your environment:

```typescript
import { setBICOverride } from 'a2a-iso-gateway';

setBICOverride('200000', 'BARCGB22XXX');
```

---

## Tokenized MMF Extension

When `SupplementaryData.TokenizedMMFMetadata` is present on an OB payment, the gateway generates a `TokenizationInstruction` alongside the ISO 20022 message and sets `Purp/Cd = SECU`.

```typescript
const result = translateOBDomesticPayment(paymentWithMMFMetadata);
console.log(result.tokenizationInstruction);
// → { instructionId, fundIdentifier, subscriptionAmount, linkedISO20022MessageId, ... }
```

See [docs/tokenized-mmf-extension.md](docs/tokenized-mmf-extension.md) for the full integration guide.

---

## Test Vectors

`test/vectors/` holds 22 realistic input messages across 7 mapping suites (OB domestic payments, FDX, payment status, settlement, credit notification, MMF, sort-code variants). These are input fixtures only — expected outputs are asserted by the 58 unit tests in `test/unit/` (24 enrichment + 34 translator cases), which do not read the vectors directory. Per-suite `mapping-notes.md` files and paired expected-output vectors are planned contributions; PRs welcome.

```bash
npm test              # run all tests
npm run test:coverage # with coverage report
```

---

## Sandbox

Run the mock server locally to see the full async OB → ISO 20022 flow:

```bash
# Terminal 1: mock server (fires auto-status webhook 2s after each payment)
npm run sandbox:server

# Terminal 2: message inspector UI (React/Vite)
cd sandbox/message-inspector && npm install && npm run dev
```

Then open http://localhost:5173 and POST to `http://localhost:3000/webhooks/payment-created`.

Runnable end-to-end scripts live in [`examples/`](examples/): `fdx-payment.ts`, `ob-domestic-payment.ts`, and `mmf-subscription.ts`. Field-level mapping guidance (including the FDX profile) is in [`docs/fdx-mapping-guide.md`](docs/fdx-mapping-guide.md).

---

## Contributing

1. Fork the repo and create a branch from `main`
2. Add tests for any new functionality — all PRs must maintain coverage
3. Document any new field mappings in `docs/mapping-guide.md`
4. Open a PR — CI must pass before merge

For questions, open a GitHub issue.

---

## License

Apache 2.0 — includes explicit patent grant required by banks and custodians. See [LICENSE](LICENSE).

Built by [PostOakLabs](https://postoaklabs.com).
