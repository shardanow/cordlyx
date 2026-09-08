import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ApiKeyOrJwtAuthGuard, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { ApiZodQuery, ApiErrorResponses, ApiListResponse } from '../../common/index.js';
import { SearchService } from './search.service.js';
import { searchSchema } from '@cordlyx/shared';

@Controller('search')
@UseGuards(ApiKeyOrJwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Full-text search across accessible items' })
  @ApiZodQuery(searchSchema)
  @ApiListResponse('Matching items, highest rank first.', {
    id: '00000000-0000-0000-0000-000000000001',
    sequenceNum: 2,
    title: 'Login page is broken on mobile',
  })
  @ApiErrorResponses(400, 401, 429)
  async search(@Query() query: unknown, @CurrentUser() user: AuthenticatedUser) {
    const data = searchSchema.parse(query);
    return this.searchService.search(data.q, user.id, data.projectId, {
      cursor: data.cursor,
      limit: data.limit,
    });
  }
}
