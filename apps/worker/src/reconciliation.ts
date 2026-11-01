import { PolygonBlockchainClient } from '@docauth/blockchain-client';
import { prisma } from './prisma';

export class StateReconciliationWorker {
  private client: PolygonBlockchainClient;
  private readonly documentRegistryAddress: string;

  constructor() {
    const rpcUrl = process.env.POLYGON_RPC_URL || 'https://rpc-amoy.polygon.technology';
    const chainId = Number(process.env.POLYGON_CHAIN_ID || '80002');
    this.client = new PolygonBlockchainClient(rpcUrl, chainId);
    this.documentRegistryAddress = process.env.DOCUMENT_REGISTRY_ADDRESS || '0x2222222222222222222222222222222222222222';
  }

  /**
   * Verifies consistency between PostgreSQL documents and Polygon smart contract state.
   */
  async runReconciliationCycle(): Promise<{ checked: number; drifted: number; verified: number }> {
    console.log('[ReconciliationWorker] Starting state reconciliation cycle...');
    const activeDocuments = await prisma.document.findMany({
      where: { documentStatus: 'ACTIVE' },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    let drifted = 0;
    let verified = 0;

    const docContract = this.client.getDocumentRegistry(this.documentRegistryAddress);

    for (const doc of activeDocuments) {
      try {
        const onChain = await docContract.getCredential(doc.credentialId);
        const onChainCommitment = onChain.commitment;
        const onChainStatus = Number(onChain.status); // 0 = NON_EXISTENT, 1 = ACTIVE, 2 = REVOKED

        if (onChainCommitment.toLowerCase() !== doc.commitment.toLowerCase()) {
          console.error(
            `[ReconciliationWorker] CRITICAL DRIFT DETECTED for document ${doc.id}! DB commitment: ${doc.commitment}, On-Chain: ${onChainCommitment}`,
          );
          drifted++;
          continue;
        }

        if (onChainStatus === 2) {
          console.warn(
            `[ReconciliationWorker] Document ${doc.id} revoked on-chain but ACTIVE in DB. Updating local record...`,
          );
          await prisma.document.update({
            where: { id: doc.id },
            data: { documentStatus: 'REVOKED' },
          });
          drifted++;
          continue;
        }

        verified++;
      } catch (err: any) {
        // Contract lookup failed (RPC offline or credential not yet mined)
        // Treated gracefully
      }
    }

    console.log(
      `[ReconciliationWorker] Cycle complete: ${activeDocuments.length} checked, ${verified} verified, ${drifted} drifted`,
    );
    return { checked: activeDocuments.length, drifted, verified };
  }
}
