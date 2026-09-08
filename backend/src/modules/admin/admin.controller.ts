import { Controller, Get, Patch, Delete, Param, Query, Body, UseGuards, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { ApiOperation, ApiBody, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AdminGuard, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { ApiUuidParam, ApiErrorResponses, ApiListResponse } from '../../common/index.js';
import { AdminService } from './admin.service.js';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('check')
  @ApiOperation({ summary: 'Check whether the current user is a server admin' })
  @ApiResponse({ status: 200, description: '{ isAdmin }.' })
  @ApiErrorResponses(401, 429)
  @UseGuards(JwtAuthGuard)
  async check(@CurrentUser() user: AuthenticatedUser) {
    const isAdmin = await this.adminService.isAdmin(user.id, user.email);
    return { isAdmin };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Server-wide stats (users, projects, items)' })
  @ApiResponse({ status: 200, description: 'Aggregated stats.' })
  @ApiErrorResponses(401, 403, 429)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async stats() {
    return this.adminService.getStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users (server admin)' })
  @ApiListResponse('Users.')
  @ApiErrorResponses(401, 403, 429)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listUsers() {
    return this.adminService.listUsers();
  }

  @Patch('users/:id/make-admin')
  @ApiOperation({ summary: 'Promote a user to server admin' })
  @ApiUuidParam('id', 'User id.')
  @ApiResponse({ status: 200, description: '{ message }.' })
  @ApiErrorResponses(401, 403, 404, 429)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async makeAdmin(@Param('id') id: string) {
    await this.adminService.makeAdmin(id);
    return { message: 'User promoted to admin' };
  }

  @Patch('users/:id/deactivate')
  @ApiOperation({ summary: 'Deactivate a user (they can no longer log in)' })
  @ApiUuidParam('id', 'User id.')
  @ApiResponse({ status: 200, description: '{ message }.' })
  @ApiErrorResponses(401, 403, 404, 429)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deactivateUser(@Param('id') id: string) {
    await this.adminService.deactivateUser(id);
    return { message: 'User deactivated' };
  }

  @Get('projects')
  @ApiOperation({ summary: 'List all projects (server admin)' })
  @ApiListResponse('Projects.')
  @ApiErrorResponses(401, 403, 429)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listProjects() {
    return this.adminService.listProjects();
  }

  @Get('projects/:id/members')
  @ApiOperation({ summary: 'List members of any project (server admin)' })
  @ApiUuidParam('id', 'Project id.')
  @ApiListResponse('Members with roles.')
  @ApiErrorResponses(401, 403, 404, 429)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getProjectMembers(@Param('id') id: string) {
    return this.adminService.getMembersForProject(id);
  }

  @Patch('projects/:id/members/:memberId/role')
  @ApiOperation({ summary: 'Change any membership role (server admin)' })
  @ApiUuidParam('id', 'Project id.')
  @ApiUuidParam('memberId', 'Membership id.')
  @ApiBody({
    description: 'New role.',
    schema: { type: 'object', properties: { role: { type: 'string' } }, required: ['role'] },
  })
  @ApiResponse({ status: 200, description: 'The updated membership.' })
  @ApiErrorResponses(400, 401, 403, 404, 429)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateMemberRole(
    @Param('id') projectId: string,
    @Param('memberId') memberId: string,
    @Body('role') role: string,
  ) {
    return this.adminService.updateMemberRole(projectId, memberId, role);
  }

  @Patch('projects/:id/archive')
  @ApiOperation({ summary: 'Archive any project (server admin)' })
  @ApiUuidParam('id', 'Project id.')
  @ApiResponse({ status: 200, description: '{ message }.' })
  @ApiErrorResponses(401, 403, 404, 429)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async archiveProject(@Param('id') id: string) {
    await this.adminService.archiveProject(id);
    return { message: 'Project archived' };
  }

  @Delete('projects/:id')
  @ApiOperation({ summary: 'Delete any project (server admin, irreversible)' })
  @ApiUuidParam('id', 'Project id.')
  @ApiResponse({ status: 204, description: 'Project deleted.' })
  @ApiErrorResponses(401, 403, 404, 429)
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteProject(@Param('id') id: string) {
    await this.adminService.deleteProject(id);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Server-wide activity (server admin, cursor pagination)' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor.' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size 1–100 (default 50).', schema: { type: 'integer', default: 50 } })
  @ApiResponse({ status: 200, description: 'Activity entries, newest first.' })
  @ApiErrorResponses(400, 401, 403, 429)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async activity(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    let parsedLimit = 50;
    if (limit !== undefined) {
      parsedLimit = Number(limit);
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        throw new BadRequestException('Invalid limit');
      }
    }
    return this.adminService.getGlobalActivity(cursor, parsedLimit);
  }
}
