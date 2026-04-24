import { v4 as uuidv4 } from 'uuid';
import { TokenizedMMFMetadata, TokenizationInstruction } from '../types';

/**
 * Stub integration point for iso20022-token-bridge (POL Opportunity 1).
 * Generates a TokenizationInstruction linked to an ISO 20022 pain.001 message.
 * When iso20022-token-bridge is available, replace this with a real call to
 * its generateTokenizationInstruction() function.
 */
export function generateTokenizationInstruction(
  metadata: TokenizedMMFMetadata,
  subscriptionAmount: string,
  currency: string,
  linkedISO20022MessageId: string
): TokenizationInstruction {
  return {
    instructionId: uuidv4(),
    fundIdentifier: metadata.fundIdentifier,
    subscriptionAmount,
    currency,
    investorWalletAddress: metadata.onChainWalletAddress,
    blockchainNetwork: metadata.blockchainNetwork,
    linkedISO20022MessageId,
  };
}
