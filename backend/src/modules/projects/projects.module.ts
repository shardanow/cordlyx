import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';
import { ProjectConfigController } from './project-config.controller.js';
import { ProjectConfigService } from './project-config.service.js';
import { ProjectMembersController } from './project-members.controller.js';
import { ProjectMembersService } from './project-members.service.js';
import { InvitesService } from './invites.service.js';

@Module({
  controllers: [ProjectsController, ProjectMembersController, ProjectConfigController],
  providers: [ProjectsService, ProjectMembersService, ProjectConfigService, InvitesService],
  exports: [ProjectsService, ProjectMembersService],
})
export class ProjectsModule {}
