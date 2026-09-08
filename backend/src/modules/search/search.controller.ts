import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiKeyOrJwtAuthGuard, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { SearchService } from './search.service.js';
import { searchSchema } from '@cordlyx/shared';

@Controller('search')
@UseGuards(ApiKeyOrJwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(@Query() query: unknown, @CurrentUser() user: AuthenticatedUser) {
    const data = searchSchema.parse(query);
    return this.searchService.search(data.q, user.id, data.projectId, {
      cursor: data.cursor,
      limit: data.limit,
    });
  }
}
