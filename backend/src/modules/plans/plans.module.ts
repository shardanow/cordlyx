import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller.js';
import { PlansService } from './plans.service.js';
import { PlansTransferService } from './plans-transfer.service.js';

@Module({
  controllers: [PlansController],
  providers: [PlansService, PlansTransferService],
  exports: [PlansService, PlansTransferService],
})
export class PlansModule {}
