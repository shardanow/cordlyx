import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiKeyOrJwtAuthGuard, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { ApiZodQuery, ApiErrorResponses } from '../../common/index.js';
import { SearchService } from './search.service.js';
import { searchSchema } from '@cordlyx/shared';

@Controller('search')
@UseGuards(ApiKeyOrJwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Full-text search across accessible items' })
  @ApiZodQuery(searchSchema)
  @ApiResponse({ status: 200, description: 'Matching items, highest rank first (max `limit`).' })
  @ApiErrorResponses(400, 401, 429)
  async search(@Query() query: unknown, @CurrentUser() user: AuthenticatedUser) {
    const data = searchSchema.parse(query);
    return this.searchService.search(data.q, user.id, data.projectId, {
      cursor: data.cursor,
      limit: data.limit,
    });
  }
}
