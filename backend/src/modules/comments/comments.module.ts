import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller.js';
import { CommentsService } from './comments.service.js';
import { ReactionsController } from './reactions.controller.js';
import { ReactionsService } from './reactions.service.js';

@Module({
  controllers: [CommentsController, ReactionsController],
  providers: [CommentsService, ReactionsService],
})
export class CommentsModule {}
