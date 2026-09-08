import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, UseInterceptors, UploadedFile, Req, Res, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ApiKeyOrJwtAuthGuard, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole } from '../../common/index.js';
import { PlansService } from './plans.service.js';
import { PlansTransferService, plansBulkSchema } from './plans-transfer.service.js';
import { TRANSFER_MAX_BYTES, parseFlag, stripInternal } from '../../common/transfer.util.js';
import { createPlanSchema, updatePlanSchema } from '@cordlyx/shared';

@ApiTags('plans')
@Controller('projects/:projectSlug/plans')
@UseGuards(ApiKeyOrJwtAuthGuard, ProjectMembershipGuard)
export class PlansController {
  constructor(
    private readonly plansService: PlansService,
    private readonly transferService: PlansTransferService,
  ) {}

  @Get()
  async list(@Req() req: Request) {
    return this.plansService.list(req.projectId as string);
  }

  @Post()
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async create(@Req() req: Request, @Body() body: unknown) {
    const data = createPlanSchema.parse(body);
    return this.plansService.create(req.projectId as string, data);
  }

  @Patch(':id')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async update(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const data = updatePlanSchema.parse(body);
    return this.plansService.update(req.projectId as string, id, data);
  }

  @Delete(':id')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async delete(@Req() req: Request, @Param('id') id: string) {
    return this.plansService.delete(req.projectId as string, id);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export project plans as CSV, JSON or JSONL (?format=csv|json|jsonl)' })
  @ApiResponse({ status: 200, description: 'File download with Content-Disposition: attachment' })
  async export(
    @Param('projectSlug') slug: string,
    @Req() req: Request,
    @Query('format') format: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const fmt = format === 'json' || format === 'jsonl' ? format : 'csv';
    const body = await this.transferService.exportAll(req.projectId as string, fmt);
    const ext = fmt === 'jsonl' ? 'jsonl' : fmt;
    res.set({
      'Content-Type':
        fmt === 'csv'
          ? 'text/csv; charset=utf-8'
          : fmt === 'json'
            ? 'application/json; charset=utf-8'
            : 'application/x-ndjson; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}-plans.${ext}"`,
    });
    return typeof body === 'string' ? body : JSON.stringify(body, null, 2);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Create up to 100 plans in one request (supports dedupe and dryRun)' })
  @ApiResponse({ status: 201, description: 'Per-item results: created | skipped | failed' })
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async bulk(
    @Req() req: Request,
    @Body() body: unknown,
    @Query('dedupe') dedupeQuery?: string,
    @Query('dryRun') dryRunQuery?: string,
  ) {
    const normalized = Array.isArray(body) ? { items: body } : body;
    const parsed = plansBulkSchema.parse(normalized);
    const { data, meta } = await this.transferService.bulkCreate(req.projectId as string, parsed.items, {
      dedupe: parseFlag(dedupeQuery, parsed.dedupe),
      dryRun: parseFlag(dryRunQuery, parsed.dryRun),
    });
    return { data: stripInternal(data), meta };
  }

  @Post('import')
  @ApiOperation({ summary: 'Import plans from a CSV, JSON or JSONL file (max 10 MB, 100 rows)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] },
  })
  @ApiResponse({ status: 201, description: 'Per-row results: created | skipped | failed' })
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
      throw new BadRequestException('No file uploaded (multipart field "file": .csv, .json or .jsonl, max 10 MB)');
    }
    const { data, meta } = await this.transferService.importFile(
      req.projectId as string,
      { originalname: file.originalname, buffer: file.buffer },
      { dedupe: parseFlag(dedupeQuery, true), dryRun: parseFlag(dryRunQuery, false) },
    );
    return { data: stripInternal(data), meta };
  }
}
