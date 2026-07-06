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
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { RoadmapsService } from './roadmaps.service.js';
import { createRoadmapSchema, updateRoadmapSchema, roadmapFilterSchema, scheduleItemSchema, createRoadmapLaneSchema, updateRoadmapLaneSchema } from '@cordlyx/shared';

@Controller('projects/:projectSlug/roadmaps')
@UseGuards(JwtAuthGuard, ProjectMembershipGuard)
export class RoadmapsController {
  constructor(private readonly roadmapsService: RoadmapsService) {}

  @Get()
  async list(@Req() req: Request, @Query() query: unknown) {
    const filters = roadmapFilterSchema.parse(query);
    return this.roadmapsService.list(req.projectId as string, filters);
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
  async createLane(@Param('id') id: string, @Body() body: unknown) {
    const data = createRoadmapLaneSchema.parse(body);
    return this.roadmapsService.createLane(id, data);
  }

  @Patch(':id/lanes/:laneId')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async updateLane(@Param('laneId') laneId: string, @Body() body: unknown) {
    const data = updateRoadmapLaneSchema.parse(body);
    return this.roadmapsService.updateLane(laneId, data);
  }

  @Delete(':id/lanes/:laneId')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async deleteLane(@Param('laneId') laneId: string) {
    return this.roadmapsService.deleteLane(laneId);
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
