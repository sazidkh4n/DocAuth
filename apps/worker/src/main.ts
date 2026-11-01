import * as dotenv from 'dotenv';
import * as path from 'path';
import { BlockchainTransactionProcessor } from './blockchain-processor';
import { BlockchainEventIndexer } from './event-indexer';
import { StateReconciliationWorker } from './reconciliation';
import { prisma } from './prisma';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

console.log('===============================================================');
console.log('Decentralized Document Platform - Background Worker Service');
console.log('Anchored on Polygon PoS (Amoy Testnet / Mainnet)');
console.log('===============================================================');

const processor = new BlockchainTransactionProcessor();
const indexer = new BlockchainEventIndexer();
const reconciler = new StateReconciliationWorker();

let isRunning = true;

async function runWorkerLoops() {
  console.log('[Worker] Starting background execution loops...');

  // Outbox Transaction Processing Loop (every 3 seconds)
  setInterval(async () => {
    if (!isRunning) return;
    try {
      await processor.processBatch();
    } catch (err: any) {
      console.error(`[Worker] Outbox processing error: ${err.message}`);
    }
  }, 3000);

  // Blockchain Event Indexer Loop (every 10 seconds)
  setInterval(async () => {
    if (!isRunning) return;
    try {
      await indexer.indexEvents();
    } catch (err: any) {
      console.error(`[Worker] Event indexer error: ${err.message}`);
    }
  }, 10000);

  // Periodic State Drift Reconciliation Loop (every 60 seconds)
  setInterval(async () => {
    if (!isRunning) return;
    try {
      await reconciler.runReconciliationCycle();
    } catch (err: any) {
      console.error(`[Worker] Reconciliation cycle error: ${err.message}`);
    }
  }, 60000);
}

runWorkerLoops();

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('[Worker] Shutting down gracefully...');
  isRunning = false;
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[Worker] Terminating gracefully...');
  isRunning = false;
  await prisma.$disconnect();
  process.exit(0);
});
