import { Module } from '@nestjs/common';
import { IssuerKeysService } from './issuer-keys.service';
import { IssuerKeysController } from './issuer-keys.controller';

@Module({
  controllers: [IssuerKeysController],
  providers: [IssuerKeysService],
  exports: [IssuerKeysService],
})
export class IssuerKeysModule {}

