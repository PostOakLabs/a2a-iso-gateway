# FDX → ISO 20022 Field Mapping Guide

**Spec versions:** FDX v5.0 · ISO 20022 CBPR+ 2024

---

## FDXPaymentInitiation → pain.001.001.09

| FDX Field | ISO 20022 Path | Notes |
|---|---|---|
| `paymentId` | `GrpHdr/MsgId` (generated UUID) | FDX ID used as `InstrId` and `EndToEndId` |
| `paymentAmount` | `CdtTrfTxInf/Amt/InstdAmt` | String preserved, no float arithmetic |
| `paymentCurrency` | `InstdAmt/@Ccy` | USD standard; warn if other |
| `debtorAccount.routingTransitNumber` | `DbtrAgt/FinInstnId/ClrSysMmbId/MmbId` | ABA routing number, `ClrSysId/Cd = USABA` |
| `debtorAccount.accountId` | `DbtrAcct/Id/Othr/Id` | Account number as BBAN |
| `creditorAccount.routingTransitNumber` | `CdtrAgt/FinInstnId/ClrSysMmbId/MmbId` | Same pattern as debtor |
| `creditorAccount.accountId` | `CdtrAcct/Id/Othr/Id` | |
| `creditorName` | `CdtTrfTxInf/Cdtr/Nm` | |
| `debtorName` | `PmtInf/Dbtr/Nm` | |
| `purposeCode` | `CdtTrfTxInf/Purp/Cd` | Via `mapPurposeCode()` |
| `remittanceInfo` | `CdtTrfTxInf/RmtInf/Ustrd` | Always unstructured for FDX |
| `sameDayFlag = true` | `LclInstrm/Cd = WIRE` | Default `ACH` |
| `creationDateTime` | `GrpHdr/CreDtTm` | |

## FDXPaymentConfirmation → pacs.008.001.10

| FDX Field | ISO 20022 Path | Notes |
|---|---|---|
| `paymentId` | `CdtTrfTxInf/PmtId/InstrId` | |
| `originalPaymentId` | `CdtTrfTxInf/PmtId/EndToEndId` | |
| `settlementAmount` | `IntrBkSttlmAmt` | pacs.008-specific field |
| `settlementCurrency` | `IntrBkSttlmAmt/@Ccy` | |
| `settlementDate` | `IntrBkSttlmDt` | Date only |
| `debtorAgent.routingNumber` | `DbtrAgt/FinInstnId/ClrSysMmbId/MmbId` | USABA |
| `creditorAgent.routingNumber` | `CdtrAgt/FinInstnId/ClrSysMmbId/MmbId` | USABA |
| `chargeBearer` | `ChrgBr` | Default `SLEV` |

## Key Differences from OB UK

1. **No IBAN generation** — US accounts use ABA routing + account ID as BBAN
2. **USABA clearing system** — all routing numbers tagged with `ClrSysId/Cd = USABA`
3. **No BIC lookup** — BIC lookup is UK-specific; FDX uses ABA routing exclusively
4. **Remittance always unstructured** — FDX `remittanceInfo` is free text
5. **Local instrument** — ACH (default) or WIRE (same-day), not FASTER/SEPA
