// ─── Open Banking UK (OBIE v3.1.10) ─────────────────────────────────────────

export interface OBAccount {
  SchemeName: string;
  Identification: string;
  Name?: string;
  SecondaryIdentification?: string;
}

export interface OBInstructedAmount {
  Amount: string;
  Currency: string;
}

export interface OBPostalAddress {
  AddressType?: string;
  StreetName?: string;
  BuildingNumber?: string;
  PostCode?: string;
  TownName?: string;
  CountrySubDivision?: string;
  Country?: string;
  AddressLine?: string[];
}

export interface OBDomesticPaymentInitiation {
  InstructionIdentification: string;
  EndToEndIdentification: string;
  InstructedAmount: OBInstructedAmount;
  DebtorAccount?: OBAccount;
  CreditorAccount: OBAccount;
  CreditorPostalAddress?: OBPostalAddress;
  LocalInstrument?: string;
  RemittanceInformation?: {
    Unstructured?: string;
    Reference?: string;
  };
  SupplementaryData?: {
    TokenizedMMFMetadata?: TokenizedMMFMetadata;
  };
}

export interface OBDomesticPaymentRequest {
  Data: {
    Initiation: OBDomesticPaymentInitiation;
    DebtorName?: string;
    PaymentContextCode?: string;
    CreationDateTime?: string;
  };
  Risk: {
    PaymentContextCode?: string;
    MerchantCategoryCode?: string;
    DeliveryAddress?: OBPostalAddress;
  };
}

export interface OBPaymentStatus {
  Data: {
    DomesticPaymentId: string;
    Status:
      | 'Pending'
      | 'AcceptedSettlementInProcess'
      | 'AcceptedSettlementCompleted'
      | 'AcceptedCreditSettlementCompleted'
      | 'AcceptedWithoutPosting'
      | 'Rejected';
    StatusUpdateDateTime: string;
    CreationDateTime: string;
    StatusReason?: {
      StatusReasonCode?: string;
      StatusReasonDescription?: string;
    };
    Initiation?: OBDomesticPaymentInitiation;
  };
  Links?: { Self: string };
  Meta?: Record<string, unknown>;
}

// ─── FDX (US Financial Data Exchange) ────────────────────────────────────────

export interface FDXAccount {
  accountId: string;
  routingTransitNumber?: string;
  accountType?: 'CHECKING' | 'SAVINGS' | 'MONEY_MARKET' | 'OTHER';
}

export interface FDXPaymentInitiation {
  paymentId: string;
  paymentAmount: string;
  paymentCurrency: string;
  debtorAccount?: FDXAccount;
  creditorAccount: FDXAccount;
  creditorName?: string;
  debtorName?: string;
  purposeCode?: string;
  remittanceInfo?: string;
  creationDateTime?: string;
  sameDayFlag?: boolean;
}

export interface FDXPaymentConfirmation {
  paymentId: string;
  originalPaymentId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  settlementAmount: string;
  settlementCurrency: string;
  settlementDate?: string;
  debtorAgent?: { routingNumber: string; name?: string };
  creditorAgent?: { routingNumber: string; name?: string };
  chargeBearer?: 'DEBT' | 'CRED' | 'SHAR' | 'SLEV';
  statusReason?: string;
  confirmationDateTime?: string;
}

// ─── Settlement Confirmation (for pacs.008) ──────────────────────────────────

export interface SettlementConfirmation {
  messageId: string;
  originalMessageId: string;
  settlementAmount: string;
  settlementCurrency: string;
  settlementDate: string;
  instructionId: string;
  endToEndId: string;
  debtorName?: string;
  debtorAccount?: { iban?: string; bban?: string };
  debtorAgentBIC: string;
  creditorName?: string;
  creditorAccount?: { iban?: string; bban?: string };
  creditorAgentBIC: string;
  chargeBearer?: 'DEBT' | 'CRED' | 'SHAR' | 'SLEV';
  purposeCode?: string;
  creationDateTime?: string;
}

// ─── A2A Credit Notification (for camt.054) ──────────────────────────────────

export interface A2ACreditNotification {
  notificationId: string;
  messageId?: string;
  creationDateTime?: string;
  recipientName?: string;
  recipientAccount: { iban?: string; bban?: string; accountId?: string };
  entryId?: string;
  amount: string;
  currency: string;
  bookingDate?: string;
  valueDate?: string;
  status: 'BOOK' | 'PDNG';
  endToEndId?: string;
  instructionId?: string;
  debtorName?: string;
  remittanceInfo?: string;
}

// ─── POL Extension ───────────────────────────────────────────────────────────

export interface TokenizedMMFMetadata {
  fundIdentifier: string;
  fundName?: string;
  onChainWalletAddress?: string;
  blockchainNetwork?: 'ethereum' | 'xrpl' | 'stellar';
}

// ─── Output Types ─────────────────────────────────────────────────────────────

export type ISO20022MessageType = 'pain.001' | 'pain.002' | 'pacs.008' | 'camt.054';

export type WarningSeverity = 'INFO' | 'WARNING' | 'ERROR';

export interface MappingWarning {
  field: string;
  severity: WarningSeverity;
  message: string;
  isoPath?: string;
}

export interface TokenizationInstruction {
  instructionId: string;
  fundIdentifier: string;
  subscriptionAmount: string;
  currency: string;
  investorWalletAddress?: string;
  blockchainNetwork?: string;
  linkedISO20022MessageId: string;
}

export interface ISO20022Result {
  messageType: ISO20022MessageType;
  messageId: string;
  creationDateTime: string;
  xmlDocument: string;
  mappingWarnings: MappingWarning[];
  tokenizationInstruction?: TokenizationInstruction;
}

export interface TranslationOptions {
  convertSortCodeToIBAN?: boolean;
  instructingAgentBIC?: string;
  instructedAgentBIC?: string;
  validateOutput?: boolean;
  purposeCodeOverride?: string;
}

// ─── Enrichment Internal Types ────────────────────────────────────────────────

export interface RemittanceBlock {
  structured?: {
    creditorReference: string;
  };
  unstructured?: string;
}
