import { RemittanceBlock } from '../types';

// Matches invoice/creditor reference patterns like INV-12345, REF-ABC, SI001, PO-2024-001
const STRUCTURED_REF_PATTERN = /^(INV|REF|SI|PO)-?[\w\d]+$/i;

export function generateRemittance(
  reference?: string,
  unstructured?: string
): RemittanceBlock {
  const ref = reference?.trim();
  const unstruct = unstructured?.trim();

  if (ref && STRUCTURED_REF_PATTERN.test(ref)) {
    return { structured: { creditorReference: ref } };
  }

  // Use reference as unstructured if it doesn't match structured pattern
  const fallbackText = ref || unstruct;
  if (fallbackText) {
    return { unstructured: fallbackText };
  }

  return {};
}
