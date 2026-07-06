import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole } from '../../common/index.js';
import { ProjectMembersService } from './project-members.service.js';
import { addMemberSchema, updateMemberSchema } from '@cordlyx/shared';

@Controller('projects/:projectSlug/members')
@UseGuards(JwtAuthGuard, ProjectMembershipGuard)
export class ProjectMembersController {
  constructor(private readonly membersService: ProjectMembersService) {}

  @Get()
  async list(@Req() req: Request) {
    return this.membersService.getMembers(req.projectId as string);
  }

  @Post()
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async add(@Req() req: Request, @Body() body: unknown) {
    const data = addMemberSchema.parse(body);
    return this.membersService.addMember(req.projectId as string, { userId: data.userId, email: data.email }, data.role);
  }

  @Patch(':memberId')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async update(@Req() req: Request, @Param('memberId') memberId: string, @Body() body: unknown) {
    const data = updateMemberSchema.parse(body);
    return this.membersService.updateMember(req.projectId as string, memberId, data.role);
  }

  @Delete(':memberId')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async remove(@Req() req: Request, @Param('memberId') memberId: string) {
    return this.membersService.removeMember(req.projectId as string, memberId);
  }
}
