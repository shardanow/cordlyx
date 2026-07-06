import { Controller, Get, Patch, Delete, Param, Query, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard, AdminGuard, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { AdminService } from './admin.service.js';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('check')
  @UseGuards(JwtAuthGuard)
  async check(@CurrentUser() user: AuthenticatedUser) {
    const isAdmin = await this.adminService.isAdmin(user.id, user.email);
    return { isAdmin };
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async stats() {
    return this.adminService.getStats();
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listUsers() {
    return this.adminService.listUsers();
  }

  @Patch('users/:id/make-admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async makeAdmin(@Param('id') id: string) {
    await this.adminService.makeAdmin(id);
    return { message: 'User promoted to admin' };
  }

  @Patch('users/:id/deactivate')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deactivateUser(@Param('id') id: string) {
    await this.adminService.deactivateUser(id);
    return { message: 'User deactivated' };
  }

  @Get('projects')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listProjects() {
    return this.adminService.listProjects();
  }

  @Get('projects/:id/members')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getProjectMembers(@Param('id') id: string) {
    return this.adminService.getMembersForProject(id);
  }

  @Patch('projects/:id/members/:memberId/role')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateMemberRole(
    @Param('id') projectId: string,
    @Param('memberId') memberId: string,
    @Body('role') role: string,
  ) {
    return this.adminService.updateMemberRole(projectId, memberId, role);
  }

  @Patch('projects/:id/archive')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async archiveProject(@Param('id') id: string) {
    await this.adminService.archiveProject(id);
    return { message: 'Project archived' };
  }

  @Delete('projects/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteProject(@Param('id') id: string) {
    await this.adminService.deleteProject(id);
  }

  @Get('activity')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async activity(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return this.adminService.getGlobalActivity(cursor, limit ? parseInt(limit, 10) : 50);
  }
}
