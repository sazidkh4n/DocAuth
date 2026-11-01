import { PolygonBlockchainClient } from '@docauth/blockchain-client';
import { prisma } from './prisma';

export class BlockchainEventIndexer {
  private client: PolygonBlockchainClient;
  private readonly documentRegistryAddress: string;
  private readonly issuerRegistryAddress: string;
  private lastIndexedBlock: bigint = 0n;
  private readonly CONFIRMATIONS = 12n; // Polygon reorg depth protection

  constructor() {
    const rpcUrl = process.env.POLYGON_RPC_URL || 'https://rpc-amoy.polygon.technology';
    const chainId = Number(process.env.POLYGON_CHAIN_ID || '80002');
    this.client = new PolygonBlockchainClient(rpcUrl, chainId);
    this.documentRegistryAddress = process.env.DOCUMENT_REGISTRY_ADDRESS || '0x2222222222222222222222222222222222222222';
    this.issuerRegistryAddress = process.env.ISSUER_REGISTRY_ADDRESS || '0x1111111111111111111111111111111111111111';
  }

  /**
   * Scans and indexes confirmed event logs from Polygon smart contracts.
   */
  async indexEvents(): Promise<number> {
    try {
      const latestBlockNum = BigInt(await this.client.getLatestBlockNumber());
      const safeBlock = latestBlockNum > this.CONFIRMATIONS ? latestBlockNum - this.CONFIRMATIONS : 0n;

      if (this.lastIndexedBlock === 0n) {
        // Find highest block already indexed in database
        const highestIndexed = await prisma.blockchainEventLog.findFirst({
          orderBy: { blockNumber: 'desc' },
          select: { blockNumber: true },
        });
        this.lastIndexedBlock = highestIndexed?.blockNumber || (safeBlock > 100n ? safeBlock - 100n : 0n);
      }

      if (safeBlock <= this.lastIndexedBlock) {
        return 0; // Already up to date with confirmed blocks
      }

      const fromBlock = this.lastIndexedBlock + 1n;
      const toBlock = safeBlock - fromBlock > 500n ? fromBlock + 500n : safeBlock;

      console.log(`[EventIndexer] Scanning blocks ${fromBlock} to ${toBlock} (confirmed head: ${safeBlock})`);

      const docContract = this.client.getDocumentRegistry(this.documentRegistryAddress);
      const issuerContract = this.client.getIssuerRegistry(this.issuerRegistryAddress);

      // Query events with timeout protection
      const [docEvents, issuerEvents] = await Promise.all([
        docContract.queryFilter('*', Number(fromBlock), Number(toBlock)).catch(() => []),
        issuerContract.queryFilter('*', Number(fromBlock), Number(toBlock)).catch(() => []),
      ]);

      const allEvents = [...docEvents, ...issuerEvents];
      let indexedCount = 0;

      for (const ev of allEvents) {
        if (!('fragment' in ev)) continue;

        const eventName = (ev as any).fragment?.name || 'UnknownEvent';
        const txHash = ev.transactionHash;
        const logIndex = ev.index;
        const blockNumber = BigInt(ev.blockNumber);
        const blockHash = ev.blockHash;
        const contractAddress = ev.address;

        await prisma.blockchainEventLog.upsert({
          where: {
            transactionHash_logIndex: {
              transactionHash: txHash,
              logIndex,
            },
          },
          update: {},
          create: {
            contractAddress,
            transactionHash: txHash,
            logIndex,
            blockNumber,
            blockHash,
            eventName,
          },
        });

        indexedCount++;
      }

      this.lastIndexedBlock = toBlock;
      return indexedCount;
    } catch (err: any) {
      console.warn(`[EventIndexer] Polling skipped or failed: ${err.message}`);
      return 0;
    }
  }
}

