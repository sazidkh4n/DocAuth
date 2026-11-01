import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { AdminModule } from './admin/admin.module';
import { IssuerKeysModule } from './issuer-keys/issuer-keys.module';
import { FileStorageModule } from './file-storage/file-storage.module';
import { DocumentsModule } from './documents/documents.module';
import { VerificationModule } from './verification/verification.module';
import { CredentialWalletModule } from './credential-wallet/credential-wallet.module';
import { HealthModule } from './health/health.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    PrismaModule,
    FileStorageModule,
    AuthModule,
    OrganizationsModule,
    AdminModule,
    IssuerKeysModule,
    DocumentsModule,
    VerificationModule,
    CredentialWalletModule,
    HealthModule,
    AuditModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
