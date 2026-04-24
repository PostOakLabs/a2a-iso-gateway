# Open Banking → ISO 20022 Field Mapping Guide

**Spec versions:** OBIE v3.1.10 · ISO 20022 CBPR+ 2024 · FDX v5.0

---

## 1. Creditor Account Identification

OB UK provides `SchemeName + Identification`. ISO 20022 uses IBAN or BBAN.

| OB UK SchemeName | ISO 20022 Handling | Warning Level |
|---|---|---|
| `UK.OBIE.IBAN` | Use IBAN directly in `CdtrAcct/Id/IBAN` | None |
| `UK.OBIE.SortCodeAccountNumber` | Convert via pseudo-IBAN algorithm (MOD-97) | WARNING — not a real IBAN |
| `UK.OBIE.PAN` | Not supported; `CdtrAcct` block omitted | ERROR |
| `UK.OBIE.Paym` | Mobile number; cannot convert | WARNING |

### Pseudo-IBAN Generation

When sort code + account number are provided, this library generates a pseudo-IBAN:

```
IBAN = "GB" + check_digits + "NWBK" + sort_code_6_digits + account_8_digits
```

- `NWBK` is a **placeholder** bank code, not the real bank identifier
- Check digits are calculated via ISO 13616 MOD-97
- The result is structurally valid but **not routable** through real banking infrastructure
- Use `setBICOverride()` and provide a real IBAN in production

### FDX Accounts

FDX provides `routingTransitNumber` (ABA routing, 9 digits) + `accountId`. These map to:

```xml
<ClrSysMmbId>
  <ClrSysId><Cd>USABA</Cd></ClrSysId>
  <MmbId>021000021</MmbId>
</ClrSysMmbId>
```

Never attempt IBAN generation for US accounts. Use `BBAN` fallback in `CdtrAcct/Id/Othr`.

---

## 2. Payment Type Information (`PmtTpInf`)

Controls how the payment is routed downstream.

| Input Condition | `SvcLvl/Cd` | `LclInstrm/Cd` |
|---|---|---|
| `Currency = GBP` | `NURG` (if PartyToParty) | `FASTER` |
| `Currency = EUR` | `SEPA` | — |
| `PaymentContextCode = PartyToParty` + GBP | `NURG` | `FASTER` |
| FDX + standard | — | `ACH` |
| FDX + `sameDayFlag = true` | — | `WIRE` |
| Unknown | `NURG` | — (INFO warning) |

---

## 3. Purpose Code Mapping

OB UK purpose codes map to `ExternalPurpose1Code` in ISO 20022. Most are direct 1:1 matches. Exceptions:

| OB UK | ISO 20022 | Notes |
|---|---|---|
| Any known code | Same code | Direct match |
| `TMMF` (POL ext.) | `SECU` | Tokenized MMF — emit WARNING + generate TokenizationInstruction |
| Unknown | `OTHR` | Fallback — emit WARNING |
| Absent | Omitted | `Purp` block not emitted |

---

## 4. Date Handling

| Field | Format | Notes |
|---|---|---|
| OB UK dates | ISO 8601 (`2026-04-15T10:30:00Z`) | |
| `GrpHdr/CreDtTm` | `ISODateTime` — same format | No conversion needed |
| `ReqdExctnDt/Dt` | `ISODate` — date only | Truncate time: `2026-04-15` |
| `IntrBkSttlmDt` | `ISODate` | Date only |
| `BookgDt/Dt`, `ValDt/Dt` | `ISODate` | Date only |

---

## 5. Amount Precision

- OB UK: amounts are strings (`"100.00"`) — **never** convert to `number`
- ISO 20022 `InstdAmt`: decimal value as text, currency as XML attribute
- Pass amounts as strings through the entire pipeline
- ISO 20022 allows up to 5 decimal places (`1234.56789`)

```xml
<InstdAmt Ccy="GBP">100.00</InstdAmt>
```

---

## 6. Remittance Information

| Input | ISO 20022 mapping | Element |
|---|---|---|
| `Reference` matching `INV-*`, `REF-*`, `SI*`, `PO-*` | Structured | `RmtInf/Strd/CdtrRefInf/Ref` |
| `Reference` not matching above | Unstructured | `RmtInf/Ustrd` |
| Only `Unstructured` provided | Unstructured | `RmtInf/Ustrd` |
| Neither provided | Omitted | — |

---

## 7. OB Payment Status → pain.002

| OB UK Status | ISO 20022 `TxSts` | Reason Code |
|---|---|---|
| `Pending` | `PDNG` | — |
| `AcceptedSettlementInProcess` | `ACSP` | — |
| `AcceptedSettlementCompleted` | `ACSC` | — |
| `AcceptedCreditSettlementCompleted` | `ACCC` | — |
| `AcceptedWithoutPosting` | `ACWP` | — |
| `Rejected` | `RJCT` | From `StatusReason.StatusReasonCode` or `NARR`; narrative in `AddtlInf` |

---

## 8. Confirmation of Payee Data

OB UK CoP returns a payee name confirmation. This library maps it to `CdtrAgt/FinInstnId/Nm` when present. This is a non-standard ISO 20022 field use — an INFO warning is emitted.

---

## 9. pacs.008 vs pain.001

| Dimension | pain.001 | pacs.008 |
|---|---|---|
| Sender | Customer (initiating party) | Financial institution |
| Amount field | `InstdAmt` | `IntrBkSttlmAmt` |
| Both agents required | No (creditor agent optional) | Yes — both `DbtrAgt` and `CdtrAgt` BICs required |
| `ChrgBr` | Optional | Required |
| Settlement date | `ReqdExctnDt` | `IntrBkSttlmDt` |

---

## 10. Cross-Currency

**Not supported in v0.1.** If `InstructedAmount.Currency` differs from the account currency, an `INFO` warning is emitted and the message is generated with whatever currency is provided. Cross-currency support is planned for v0.2.
