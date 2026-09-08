import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ApiKeyOrJwtAuthGuard, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { RoadmapsService } from './roadmaps.service.js';
import { RoadmapsTransferService } from './roadmaps-transfer.service.js';
import { EtagInterceptor } from '../../common/interceptors/etag.interceptor.js';
import { TRANSFER_MAX_BYTES, parseFlag } from '../../common/transfer.util.js';
import { z } from 'zod';
import { createRoadmapSchema, updateRoadmapSchema, roadmapFilterSchema, scheduleItemSchema, createRoadmapLaneSchema, updateRoadmapLaneSchema } from '@cordlyx/shared';

@ApiTags('roadmaps')
@Controller('projects/:projectSlug/roadmaps')
@UseGuards(ApiKeyOrJwtAuthGuard, ProjectMembershipGuard)
export class RoadmapsController {
  constructor(
    private readonly roadmapsService: RoadmapsService,
    private readonly transferService: RoadmapsTransferService,
  ) {}

  @Get()
  async list(@Req() req: Request, @Query() query: unknown) {
    const filters = roadmapFilterSchema.parse(query);
    return this.roadmapsService.list(req.projectId as string, filters);
  }

  @Get('export')
  @UseInterceptors(EtagInterceptor)
  @ApiOperation({ summary: 'Export all project roadmaps with lanes and schedule (?format=json|csv)' })
  @ApiResponse({ status: 200, description: 'File download with Content-Disposition: attachment' })
  async exportAll(
    @Param('projectSlug') slug: string,
    @Req() req: Request,
    @Query('format') format: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const fmt = format === 'csv' ? 'csv' : 'json';
    const body = await this.transferService.exportAll(req.projectId as string, fmt);
    res.set({
      'Content-Type': fmt === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}-roadmaps.${fmt}"`,
    });
    return typeof body === 'string' ? body : JSON.stringify(body, null, 2);
  }

  @Get(':id/export')
  @ApiOperation({ summary: 'Export a single roadmap with lanes and schedule as JSON' })
  @ApiResponse({ status: 200, description: 'File download with Content-Disposition: attachment' })
  async exportOne(
    @Param('projectSlug') slug: string,
    @Param('id') id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const body = await this.transferService.exportRoadmap(req.projectId as string, id);
    res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}-roadmap-${id.slice(0, 8)}.json"`,
    });
    return JSON.stringify(body, null, 2);
  }

  @Get(':id')
  async getById(@Req() req: Request, @Param('id') id: string) {
    const roadmap = await this.roadmapsService.getById(req.projectId as string, id);
    if (!roadmap) {
      const { NotFoundException } = await import('@nestjs/common');
      throw new NotFoundException('Roadmap not found');
    }
    return roadmap;
  }

  @Get(':id/items')
  async getRoadmapItems(@Req() req: Request, @Param('id') id: string) {
    return this.roadmapsService.getRoadmapWithItems(req.projectId as string, id);
  }

  @Get(':id/relations')
  async getRoadmapRelations(@Req() req: Request, @Param('id') id: string) {
    return this.roadmapsService.getRoadmapRelations(req.projectId as string, id);
  }

  @Post()
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async create(@Req() req: Request, @Body() body: unknown) {
    const data = createRoadmapSchema.parse(body);
    return this.roadmapsService.create(req.projectId as string, data);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import roadmaps from a JSON file (lanes auto-created, items resolved by sequence number)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] },
  })
  @ApiResponse({ status: 201, description: 'Per-roadmap results with entry stats' })
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: TRANSFER_MAX_BYTES } }))
  async import(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('dedupe') dedupeQuery?: string,
    @Query('dryRun') dryRunQuery?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded (multipart field "file": .json or .csv, max 10 MB)');
    }
    const { data, meta } = await this.transferService.importFile(
      req.projectId as string,
      { originalname: file.originalname, buffer: file.buffer },
      { dedupe: parseFlag(dedupeQuery, true), dryRun: parseFlag(dryRunQuery, false) },
    );
    return { data, meta };
  }

  @Patch(':id')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async update(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const data = updateRoadmapSchema.parse(body);
    return this.roadmapsService.update(req.projectId as string, id, data);
  }

  @Delete(':id')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async delete(@Req() req: Request, @Param('id') id: string) {
    return this.roadmapsService.delete(req.projectId as string, id);
  }

  // --- Lanes ---

  @Post(':id/lanes')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async createLane(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const data = createRoadmapLaneSchema.parse(body);
    return this.roadmapsService.createLane(id, req.projectId as string, data);
  }

  @Patch(':id/lanes/reorder')
  @ApiOperation({ summary: 'Reorder lanes atomically (ordered lane ids)' })
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async reorderLanes(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const data = z.object({ laneIds: z.array(z.string().uuid()).min(1) }).parse(body);
    return this.roadmapsService.reorderLanes(req.projectId as string, id, data.laneIds);
  }

  @Patch(':id/lanes/:laneId')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async updateLane(@Req() req: Request, @Param('laneId') laneId: string, @Body() body: unknown) {
    const data = updateRoadmapLaneSchema.parse(body);
    return this.roadmapsService.updateLane(req.projectId as string, laneId, data);
  }

  @Delete(':id/lanes/:laneId')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async deleteLane(@Req() req: Request, @Param('laneId') laneId: string) {
    return this.roadmapsService.deleteLane(req.projectId as string, laneId);
  }

  // --- Scheduling ---

  @Post(':id/schedule')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async scheduleItems(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const data = scheduleItemSchema.parse(body);
    return this.roadmapsService.scheduleItems(req.projectId as string, id, data);
  }

  @Delete(':id/items/:itemId')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async unscheduleItem(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.roadmapsService.unscheduleItem(req.projectId as string, id, itemId);
  }

  @Patch(':id/items/:itemId')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async updateItemDates(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: { startDate?: string; dueDate?: string; laneId?: string },
  ) {
    return this.roadmapsService.updateItemDates(req.projectId as string, id, itemId, body);
  }
}
