import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ApiKeyOrJwtAuthGuard, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole } from '../../common/index.js';
import { ApiZodBody, ApiProjectSlugParam, ApiUuidParam, ApiErrorResponses } from '../../common/index.js';
import { TagsService } from './tags.service.js';
import { createTagSchema } from '@cordlyx/shared';

@ApiTags('Tags')
@Controller('projects/:projectSlug/tags')
@UseGuards(ApiKeyOrJwtAuthGuard, ProjectMembershipGuard)
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  @ApiOperation({ summary: 'List project tags' })
  @ApiProjectSlugParam()
  @ApiResponse({ status: 200, description: 'Tag list.' })
  @ApiErrorResponses(401, 403, 429)
  async list(@Req() req: Request) {
    return this.tagsService.list(req.projectId as string);
  }

  @Post()
  @ApiOperation({ summary: 'Create a tag' })
  @ApiProjectSlugParam()
  @ApiZodBody(createTagSchema)
  @ApiResponse({ status: 201, description: 'The created tag.' })
  @ApiErrorResponses(400, 401, 403, 429)
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async create(@Req() req: Request, @Body() body: unknown) {
    const data = createTagSchema.parse(body);
    return this.tagsService.create(req.projectId as string, data.name, data.color);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a tag (partial)' })
  @ApiProjectSlugParam()
  @ApiUuidParam('id', 'Tag id.')
  @ApiZodBody(createTagSchema.partial())
  @ApiResponse({ status: 200, description: 'The updated tag.' })
  @ApiErrorResponses(400, 401, 403, 404, 429)
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async update(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const data = createTagSchema.partial().parse(body);
    return this.tagsService.update(req.projectId as string, id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a tag (admin only)' })
  @ApiProjectSlugParam()
  @ApiUuidParam('id', 'Tag id.')
  @ApiResponse({ status: 200, description: 'Deletion result.' })
  @ApiErrorResponses(401, 403, 404, 429)
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async delete(@Req() req: Request, @Param('id') id: string) {
    return this.tagsService.delete(req.projectId as string, id);
  }
}
