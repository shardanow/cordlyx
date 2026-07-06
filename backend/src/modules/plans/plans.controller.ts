import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, ProjectMembershipGuard } from '../../common/index.js';
import { PlansService } from './plans.service.js';
import { createPlanSchema, updatePlanSchema } from '@cordlyx/shared';

@Controller('projects/:projectSlug/plans')
@UseGuards(JwtAuthGuard, ProjectMembershipGuard)
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  async list(@Req() req: Request) {
    return this.plansService.list(req.projectId as string);
  }

  @Post()
  async create(@Req() req: Request, @Body() body: unknown) {
    const data = createPlanSchema.parse(body);
    return this.plansService.create(req.projectId as string, data);
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const data = updatePlanSchema.parse(body);
    return this.plansService.update(req.projectId as string, id, data);
  }

  @Delete(':id')
  async delete(@Req() req: Request, @Param('id') id: string) {
    return this.plansService.delete(req.projectId as string, id);
  }
}
