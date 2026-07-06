import { Module } from '@nestjs/common';
import { ItemsController } from './items.controller.js';
import { ItemsService } from './items.service.js';
import { VotesService } from './votes.service.js';
import { BoardController } from './board.controller.js';
import { QuickCreateController } from './quick-create.controller.js';

@Module({
  controllers: [ItemsController, BoardController, QuickCreateController],
  providers: [ItemsService, VotesService],
  exports: [ItemsService],
})
export class ItemsModule {}
