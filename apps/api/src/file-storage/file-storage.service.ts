import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class FileStorageService implements OnModuleInit {
  private readonly logger = new Logger(FileStorageService.name);
  private minioClient: Minio.Client | null = null;
  private readonly useMock: boolean;
  private readonly inMemoryStorage = new Map<string, { buffer: Buffer; contentType: string }>();

  public readonly permanentBucket: string;
  public readonly quarantineBucket: string;
  public readonly evidenceBucket: string;

  constructor(private configService: ConfigService) {
    this.permanentBucket = this.configService.get<string>('STORAGE_PERMANENT_BUCKET', 'docauth-permanent-documents');
    this.quarantineBucket = this.configService.get<string>('STORAGE_QUARANTINE_BUCKET', 'docauth-quarantine-uploads');
    this.evidenceBucket = this.configService.get<string>('STORAGE_EVIDENCE_BUCKET', 'docauth-organization-evidence');

    const provider = this.configService.get<string>('STORAGE_PROVIDER', 'minio');
    this.useMock = provider === 'mock';
  }

  async onModuleInit() {
    if (this.useMock) {
      this.logger.log('Using in-memory mock object storage for local testing');
      return;
    }

    try {
      const endpoint = this.configService.get<string>('STORAGE_ENDPOINT', 'localhost');
      const cleanEndpoint = endpoint.replace(/^https?:\/\//, '').split(':')[0];
      const port = Number(endpoint.split(':')[2] || 9000);
      const useSSL = this.configService.get<string>('STORAGE_USE_SSL', 'false') === 'true';

      this.minioClient = new Minio.Client({
        endPoint: cleanEndpoint,
        port,
        useSSL,
        accessKey: this.configService.get<string>('STORAGE_ACCESS_KEY', 'minioadmin'),
        secretKey: this.configService.get<string>('STORAGE_SECRET_KEY', 'minioadmin'),
      });
      this.logger.log(`Initialized MinIO client connected to ${cleanEndpoint}:${port}`);
    } catch (err: any) {
      this.logger.warn(`MinIO connection unavailable (${err.message}). Falling back to memory storage.`);
      this.minioClient = null;
    }
  }

  /**
   * Stores a file buffer in object storage.
   */
  async uploadFile(bucket: string, objectKey: string, buffer: Buffer, contentType: string): Promise<string> {
    if (this.minioClient) {
      try {
        await this.minioClient.putObject(bucket, objectKey, buffer, buffer.length, {
          'Content-Type': contentType,
        });
        return objectKey;
      } catch (err: any) {
        this.logger.warn(`MinIO upload failed (${err.message}). Saving to fallback memory store.`);
      }
    }

    // Fallback in-memory storage
    this.inMemoryStorage.set(`${bucket}:${objectKey}`, { buffer, contentType });
    return objectKey;
  }

  /**
   * Downloads a file buffer from object storage.
   */
  async downloadFile(bucket: string, objectKey: string): Promise<Buffer> {
    if (this.minioClient) {
      try {
        const stream = await this.minioClient.getObject(bucket, objectKey);
        const chunks: Buffer[] = [];
        return new Promise((resolve, reject) => {
          stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          stream.on('end', () => resolve(Buffer.concat(chunks)));
          stream.on('error', (err) => reject(err));
        });
      } catch (err: any) {
        this.logger.warn(`MinIO download failed (${err.message}). Checking memory fallback.`);
      }
    }

    const stored = this.inMemoryStorage.get(`${bucket}:${objectKey}`);
    if (!stored) {
      throw new Error(`File not found in storage: ${bucket}/${objectKey}`);
    }
    return stored.buffer;
  }

  /**
   * Deletes a file from object storage.
   */
  async deleteFile(bucket: string, objectKey: string): Promise<void> {
    if (this.minioClient) {
      try {
        await this.minioClient.removeObject(bucket, objectKey);
      } catch {
        // Ignored
      }
    }
    this.inMemoryStorage.delete(`${bucket}:${objectKey}`);
  }

  /**
   * Generates a time-limited pre-signed download URL.
   */
  async getPresignedDownloadUrl(bucket: string, objectKey: string, expiresInSeconds: number = 300): Promise<string> {
    if (this.minioClient) {
      try {
        return await this.minioClient.presignedGetObject(bucket, objectKey, expiresInSeconds);
      } catch {
        // Fallback
      }
    }

    // Local / Mock fallback download link
    const apiBase = this.configService.get<string>('API_URL', 'http://localhost:4000/api/v1');
    return `${apiBase}/storage/download/${bucket}/${objectKey}?token=mock_presigned_token`;
  }

  /**
   * Checks if storage provider is reachable / bucket exists.
   */
  async bucketExists(bucket: string): Promise<boolean> {
    if (this.minioClient) {
      try {
        return await this.minioClient.bucketExists(bucket);
      } catch {
        return false;
      }
    }
    return true; // Mock memory store is always available
  }
}
