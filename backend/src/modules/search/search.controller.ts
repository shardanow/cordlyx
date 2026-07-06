import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/index.js';
import { SearchService } from './search.service.js';
import { searchSchema } from '@cordlyx/shared';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(@Query() query: unknown) {
    const data = searchSchema.parse(query);
    return this.searchService.search(data.q, data.projectId, {
      cursor: data.cursor,
      limit: data.limit,
    });
  }
}
