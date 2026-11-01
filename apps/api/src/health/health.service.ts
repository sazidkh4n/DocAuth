import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService } from '../file-storage/file-storage.service';
import { PolygonBlockchainClient } from '@docauth/blockchain-client';
import { formatEther } from 'ethers';

@Injectable()
export class HealthService {
  private blockchainClient: PolygonBlockchainClient;
  private readonly rpcUrl: string;
  private readonly chainId: number;

  constructor(
    private prisma: PrismaService,
    private storage: FileStorageService,
    private configService: ConfigService,
  ) {
    this.rpcUrl = this.configService.get<string>(
      'POLYGON_RPC_URL',
      'https://rpc-amoy.polygon.technology',
    );
    this.chainId = Number(this.configService.get<string>('POLYGON_CHAIN_ID', '80002'));
    this.blockchainClient = new PolygonBlockchainClient(this.rpcUrl, this.chainId);
  }

  async getOverallHealth() {
    const db = await this.getDatabaseHealth();
    const storage = await this.getStorageHealth();
    const blockchain = await this.getBlockchainHealth();

    const isHealthy =
      db.status === 'HEALTHY' &&
      storage.status === 'HEALTHY' &&
      (blockchain.status === 'HEALTHY' || blockchain.status === 'DEGRADED');

    return {
      status: isHealthy ? 'OK' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      components: {
        database: db,
        storage: storage,
        blockchain: blockchain,
      },
    };
  }

  async getDatabaseHealth() {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'HEALTHY',
        latencyMs: Date.now() - start,
        message: 'PostgreSQL connection active',
      };
    } catch (err: any) {
      return {
        status: 'UNHEALTHY',
        latencyMs: Date.now() - start,
        error: err.message || 'Database connection error',
      };
    }
  }

  async getBlockchainHealth() {
    const start = Date.now();
    try {
      const blockNumber = await Promise.race([
        this.blockchainClient.getLatestBlockNumber(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('RPC timeout after 4000ms')), 4000),
        ),
      ]);

      return {
        status: 'HEALTHY',
        chainId: this.chainId,
        latestBlockNumber: blockNumber,
        latencyMs: Date.now() - start,
        rpcUrl: this.rpcUrl.split('?')[0],
      };
    } catch (err: any) {
      return {
        status: 'DEGRADED',
        chainId: this.chainId,
        latencyMs: Date.now() - start,
        error: err.message || 'Blockchain RPC unreachable',
      };
    }
  }

  async getStorageHealth() {
    const start = Date.now();
    try {
      // Check permanent bucket existence
      const exists = await this.storage.bucketExists(this.storage.permanentBucket);
      return {
        status: exists ? 'HEALTHY' : 'DEGRADED',
        bucket: this.storage.permanentBucket,
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        status: 'DEGRADED',
        error: err.message || 'Storage check failed',
        latencyMs: Date.now() - start,
      };
    }
  }
}

