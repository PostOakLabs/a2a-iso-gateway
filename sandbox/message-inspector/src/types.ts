export interface MappingWarning {
  field: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  isoPath?: string;
}

export interface ISO20022Result {
  messageType: string;
  messageId: string;
  creationDateTime: string;
  xmlDocument: string;
  mappingWarnings: MappingWarning[];
  tokenizationInstruction?: unknown;
}

export interface StoredMessage {
  id: string;
  timestamp: string;
  type: 'payment-created' | 'payment-status';
  input: unknown;
  iso20022Result: ISO20022Result;
}
