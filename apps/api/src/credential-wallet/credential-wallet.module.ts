import { Module } from '@nestjs/common';
import { CredentialWalletService } from './credential-wallet.service';
import { CredentialWalletController } from './credential-wallet.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { FileStorageModule } from '../file-storage/file-storage.module';

@Module({
  imports: [PrismaModule, FileStorageModule],
  controllers: [CredentialWalletController],
  providers: [CredentialWalletService],
  exports: [CredentialWalletService],
})
export class CredentialWalletModule {}

