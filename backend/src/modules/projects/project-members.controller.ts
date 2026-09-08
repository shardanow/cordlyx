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
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiKeyOrJwtAuthGuard, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole } from '../../common/index.js';
import { ApiZodBody, ApiProjectSlugParam, ApiUuidParam, ApiErrorResponses, ApiListResponse } from '../../common/index.js';
import { ProjectMembersService } from './project-members.service.js';
import { addMemberSchema, updateMemberSchema } from '@cordlyx/shared';

@ApiTags('ProjectMembers')
@Controller('projects/:projectSlug/members')
@UseGuards(ApiKeyOrJwtAuthGuard, ProjectMembershipGuard)
export class ProjectMembersController {
  constructor(private readonly membersService: ProjectMembersService) {}

  @Get()
  @ApiOperation({ summary: 'List project members with roles' })
  @ApiProjectSlugParam()
  @ApiListResponse('Members with roles.', { name: 'Alice Johnson', email: 'alice@example.com', role: 'admin' })
  @ApiErrorResponses(401, 403, 429)
  async list(@Req() req: Request) {
    return this.membersService.getMembers(req.projectId as string);
  }

  @Post()
  @ApiOperation({ summary: 'Add a member by userId or email (admin only)' })
  @ApiProjectSlugParam()
  @ApiZodBody(addMemberSchema)
  @ApiResponse({ status: 201, description: 'The created membership.' })
  @ApiErrorResponses(400, 401, 403, 404, 409, 429)
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async add(@Req() req: Request, @Body() body: unknown) {
    const data = addMemberSchema.parse(body);
    return this.membersService.addMember(req.projectId as string, { userId: data.userId, email: data.email }, data.role);
  }

  @Patch(':memberId')
  @ApiOperation({ summary: 'Change a member role (admin only)' })
  @ApiProjectSlugParam()
  @ApiUuidParam('memberId', 'Membership id.')
  @ApiZodBody(updateMemberSchema)
  @ApiResponse({ status: 200, description: 'The updated membership.' })
  @ApiErrorResponses(400, 401, 403, 404, 429)
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async update(@Req() req: Request, @Param('memberId') memberId: string, @Body() body: unknown) {
    const data = updateMemberSchema.parse(body);
    return this.membersService.updateMember(req.projectId as string, memberId, data.role);
  }

  @Delete(':memberId')
  @ApiOperation({ summary: 'Remove a member (admin only)' })
  @ApiProjectSlugParam()
  @ApiUuidParam('memberId', 'Membership id.')
  @ApiResponse({ status: 200, description: 'Removal result.' })
  @ApiErrorResponses(401, 403, 404, 429)
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async remove(@Req() req: Request, @Param('memberId') memberId: string) {
    return this.membersService.removeMember(req.projectId as string, memberId);
  }
}
