import { Module } from '@nestjs/common';
import { RoadmapsController } from './roadmaps.controller.js';
import { RoadmapsService } from './roadmaps.service.js';
import { RoadmapsTransferService } from './roadmaps-transfer.service.js';

@Module({
  controllers: [RoadmapsController],
  providers: [RoadmapsService, RoadmapsTransferService],
  exports: [RoadmapsService, RoadmapsTransferService],
})
export class RoadmapsModule {}
