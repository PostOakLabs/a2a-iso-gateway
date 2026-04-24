import { XMLParser } from 'fast-xml-parser';
import { MappingWarning } from '../types';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
});

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: MappingWarning[];
}

// Required top-level elements per message type
const REQUIRED_ELEMENTS: Record<string, string[]> = {
  'pain.001': ['Document', 'CstmrCdtTrfInitn', 'GrpHdr', 'PmtInf'],
  'pain.002': ['Document', 'CstmrPmtStsRpt', 'GrpHdr', 'OrgnlGrpInfAndSts'],
  'pacs.008': ['Document', 'FIToFICstmrCdtTrf', 'GrpHdr', 'CdtTrfTxInf'],
  'camt.054': ['Document', 'BkToCstmrDbtCdtNtfctn', 'GrpHdr', 'Ntfctn'],
};

export function validateXML(xml: string, messageType: string): ValidationResult {
  const errors: string[] = [];
  const warnings: MappingWarning[] = [];

  try {
    const parsed = parser.parse(xml);

    const required = REQUIRED_ELEMENTS[messageType] || [];
    for (const element of required) {
      if (!xmlContainsElement(parsed, element)) {
        errors.push(`Required element <${element}> not found in ${messageType} message`);
      }
    }

    // Check namespace declaration
    if (!xml.includes('urn:iso:std:iso:20022')) {
      warnings.push({
        field: 'xmlns',
        severity: 'WARNING',
        message: 'ISO 20022 namespace declaration not found in XML output',
        isoPath: 'Document/@xmlns',
      });
    }
  } catch (err) {
    errors.push(`XML parse error: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function xmlContainsElement(obj: unknown, elementName: string): boolean {
  if (typeof obj !== 'object' || obj === null) return false;
  const record = obj as Record<string, unknown>;
  if (elementName in record) return true;
  return Object.values(record).some((v) => xmlContainsElement(v, elementName));
}
