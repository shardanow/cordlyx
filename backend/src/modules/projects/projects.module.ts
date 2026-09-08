import { Module } from '@nestjs/common';
import { ItemsModule } from '../items/items.module.js';
import { PlansModule } from '../plans/plans.module.js';
import { RoadmapsModule } from '../roadmaps/roadmaps.module.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';
import { ProjectConfigController } from './project-config.controller.js';
import { ProjectConfigService } from './project-config.service.js';
import { ProjectConfigTransferService } from './project-config-transfer.service.js';
import { ProjectSnapshotService } from './project-snapshot.service.js';
import { ProjectStatsController } from './project-stats.controller.js';
import { ProjectStatsService } from './project-stats.service.js';
import { ProjectViewsController } from './project-views.controller.js';
import { ProjectViewsService } from './project-views.service.js';
import { ProjectMembersController } from './project-members.controller.js';
import { ProjectMembersService } from './project-members.service.js';
import { InvitesService } from './invites.service.js';

@Module({
  imports: [ItemsModule, PlansModule, RoadmapsModule],
  controllers: [ProjectsController, ProjectMembersController, ProjectConfigController, ProjectStatsController, ProjectViewsController],
  providers: [ProjectsService, ProjectMembersService, ProjectConfigService, ProjectConfigTransferService, ProjectSnapshotService, ProjectStatsService, ProjectViewsService, InvitesService],
  exports: [ProjectsService, ProjectMembersService, ProjectConfigTransferService, ProjectSnapshotService],
})
export class ProjectsModule {}
