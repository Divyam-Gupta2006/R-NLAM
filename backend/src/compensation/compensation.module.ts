import { Module } from '@nestjs/common';
import { CompensationController } from './compensation.controller';
import { CompensationService } from './compensation.service';
import { PAYMENT_GATEWAY, SyntheticPfmsGateway } from './payment-gateway';

@Module({
  controllers: [CompensationController],
  providers: [CompensationService, SyntheticPfmsGateway, { provide: PAYMENT_GATEWAY, useExisting: SyntheticPfmsGateway }],
  exports: [CompensationService],
})
export class CompensationModule {}
