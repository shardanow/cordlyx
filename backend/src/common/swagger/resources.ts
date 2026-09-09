import { ApiProperty } from '@nestjs/swagger';

/**
 * Docs-only response shapes (runtime returns plain objects from services).
 * Field lists mirror the drizzle tables / service selects; examples use seed data.
 */

const UUID = '00000000-0000-0000-0000-000000000001';
const TS = '2026-01-01T00:00:00.000Z';

export class UserResponseDto {
  @ApiProperty({ example: UUID })
  id!: string;

  @ApiProperty({ example: 'alice@example.com' })
  email!: string;

  @ApiProperty({ example: 'Alice Johnson' })
  name!: string;

  @ApiProperty({ nullable: true, example: null })
  avatarUrl!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: TS })
  createdAt!: string;

  @ApiProperty({ example: TS })
  updatedAt!: string;
}

export class ProjectResponseDto {
  @ApiProperty({ example: UUID })
  id!: string;

  @ApiProperty({ example: 'Demo Project' })
  name!: string;

  @ApiProperty({ example: 'demo' })
  slug!: string;

  @ApiProperty({ nullable: true, example: 'A demo project for testing CordLyx features' })
  description!: string | null;

  @ApiProperty({ example: UUID })
  ownerId!: string;

  @ApiProperty({ example: false })
  isArchived!: boolean;

  @ApiProperty({ example: TS })
  createdAt!: string;

  @ApiProperty({ example: TS })
  updatedAt!: string;
}

export class MemberResponseDto {
  @ApiProperty({ example: UUID })
  id!: string;

  @ApiProperty({ example: UUID })
  userId!: string;

  @ApiProperty({ enum: ['admin', 'member', 'viewer'], example: 'admin' })
  role!: string;

  @ApiProperty({ example: 'alice@example.com' })
  email!: string;

  @ApiProperty({ example: 'Alice Johnson' })
  name!: string;

  @ApiProperty({ nullable: true, example: null })
  avatarUrl!: string | null;

  @ApiProperty({ example: TS })
  joinedAt!: string;
}

class ItemTagDto {
  @ApiProperty({ example: UUID })
  id!: string;

  @ApiProperty({ example: 'frontend' })
  name!: string;

  @ApiProperty({ nullable: true, example: '#3B82F6' })
  color!: string | null;
}

export class ItemResponseDto {
  @ApiProperty({ example: UUID })
  id!: string;

  @ApiProperty({ example: UUID })
  projectId!: string;

  @ApiProperty({ description: 'Human-facing number, unique per project.', example: 1 })
  sequenceNum!: number;

  @ApiProperty({ example: 'Set up CI/CD pipeline' })
  title!: string;

  @ApiProperty({ nullable: true, example: null })
  description!: string | null;

  @ApiProperty({ description: 'From GET .../types.', example: UUID })
  typeId!: string;

  @ApiProperty({ description: 'From GET .../statuses.', example: UUID })
  statusId!: string;

  @ApiProperty({ description: 'From GET .../priorities.', example: UUID })
  priorityId!: string;

  @ApiProperty({ nullable: true, example: null })
  assigneeId!: string | null;

  @ApiProperty({ nullable: true, example: null })
  reporterId!: string | null;

  @ApiProperty({ nullable: true, example: null })
  parentId!: string | null;

  @ApiProperty({ nullable: true, example: null })
  planId!: string | null;

  @ApiProperty({ nullable: true, example: null })
  roadmapId!: string | null;

  @ApiProperty({ type: [ItemTagDto], required: false })
  tags?: ItemTagDto[];

  @ApiProperty({ nullable: true, example: null })
  dueDate!: string | null;

  @ApiProperty({ example: TS })
  createdAt!: string;

  @ApiProperty({ example: TS })
  updatedAt!: string;
}

class CommentAuthorDto {
  @ApiProperty({ example: UUID })
  id!: string;

  @ApiProperty({ example: 'Alice Johnson' })
  name!: string;

  @ApiProperty({ nullable: true, example: null })
  avatarUrl!: string | null;
}

export class CommentResponseDto {
  @ApiProperty({ example: UUID })
  id!: string;

  @ApiProperty({ example: UUID })
  itemId!: string;

  @ApiProperty({ example: UUID })
  authorId!: string;

  @ApiProperty({ nullable: true, example: null })
  parentId!: string | null;

  @ApiProperty({ example: 'Looks good, shipping it.' })
  body!: string;

  @ApiProperty({ type: CommentAuthorDto })
  author!: CommentAuthorDto;

  @ApiProperty({
    required: false,
    description: 'Reactions grouped by emoji (present on list).',
    example: { '👍': { count: 2, users: [{ id: UUID, name: 'Alice Johnson' }] } },
  })
  reactions!: Record<string, unknown>;

  @ApiProperty({ type: [Object], required: false, description: 'Nested replies, one level (present on list).' })
  replies!: unknown[];

  @ApiProperty({ example: TS })
  createdAt!: string;

  @ApiProperty({ example: TS })
  updatedAt!: string;
}

export class TagResponseDto {  @ApiProperty({ example: UUID })
  id!: string;

  @ApiProperty({ example: UUID })
  projectId!: string;

  @ApiProperty({ example: 'frontend' })
  name!: string;

  @ApiProperty({ nullable: true, example: '#3B82F6' })
  color!: string | null;

  @ApiProperty({ example: TS })
  createdAt!: string;
}

export class AttachmentResponseDto {
  @ApiProperty({ example: UUID })
  id!: string;

  @ApiProperty({ example: UUID })
  itemId!: string;

  @ApiProperty({ example: 'screenshot.png' })
  originalFilename!: string;

  @ApiProperty({ example: 'image/png' })
  mimeType!: string;

  @ApiProperty({ example: 48210 })
  sizeBytes!: number;

  @ApiProperty({ description: 'Public download URL.', example: '/uploads/<id>/screenshot.png' })
  url!: string;

  @ApiProperty({ example: TS })
  createdAt!: string;
}

export class RelationResponseDto {
  @ApiProperty({ example: UUID })
  id!: string;

  @ApiProperty({ example: UUID })
  sourceItemId!: string;

  @ApiProperty({ example: UUID })
  targetItemId!: string;

  @ApiProperty({
    enum: ['blocks', 'depends_on', 'relates_to', 'duplicates', 'child_of', 'next_action'],
    example: 'blocks',
  })
  relationType!: string;

  @ApiProperty({ example: TS })
  createdAt!: string;
}

export class PlanResponseDto {
  @ApiProperty({ example: UUID })
  id!: string;

  @ApiProperty({ example: UUID })
  projectId!: string;

  @ApiProperty({ example: 'Sprint 1' })
  name!: string;

  @ApiProperty({ nullable: true, example: null })
  description!: string | null;

  @ApiProperty({ enum: ['release', 'milestone', 'campaign', 'goal', 'sprint', 'custom'], example: 'release' })
  type!: string;

  @ApiProperty({ enum: ['active', 'completed', 'cancelled'], example: 'active' })
  status!: string;

  @ApiProperty({ nullable: true, example: '#3B82F6' })
  color!: string | null;

  @ApiProperty({ nullable: true, example: '2026-09-01', description: 'Optional start date YYYY-MM-DD.' })
  startDate!: string | null;

  @ApiProperty({ nullable: true, example: '2026-09-14', description: 'Optional end date YYYY-MM-DD.' })
  endDate!: string | null;

  @ApiProperty({ example: TS })
  createdAt!: string;

  @ApiProperty({ example: TS })
  updatedAt!: string;
}

export class RoadmapLaneResponseDto {
  @ApiProperty({ example: UUID })
  id!: string;

  @ApiProperty({ example: UUID })
  roadmapId!: string;

  @ApiProperty({ example: 'Phase 1' })
  name!: string;

  @ApiProperty({ nullable: true, example: null })
  color!: string | null;

  @ApiProperty({ example: 0 })
  sortOrder!: number;
}

export class RoadmapResponseDto {
  @ApiProperty({ example: UUID })
  id!: string;

  @ApiProperty({ example: UUID })
  projectId!: string;

  @ApiProperty({ example: 'Q3 Release' })
  name!: string;

  @ApiProperty({ nullable: true, example: null })
  description!: string | null;

  @ApiProperty({ example: '2026-07-01' })
  startDate!: string;

  @ApiProperty({ example: '2026-09-30' })
  endDate!: string;

  @ApiProperty({ nullable: true, example: '#6366f1' })
  color!: string | null;

  @ApiProperty({ example: TS })
  createdAt!: string;

  @ApiProperty({ example: TS })
  updatedAt!: string;
}

export class ViewResponseDto {
  @ApiProperty({ example: UUID })
  id!: string;

  @ApiProperty({ example: UUID })
  projectId!: string;

  @ApiProperty({ example: UUID })
  ownerId!: string;

  @ApiProperty({ example: 'My backlog' })
  name!: string;

  @ApiProperty({ example: { statusId: UUID } })
  filters!: Record<string, unknown>;

  @ApiProperty({ example: false })
  isShared!: boolean;

  @ApiProperty({ example: false })
  isDefault!: boolean;

  @ApiProperty({ example: TS })
  createdAt!: string;

  @ApiProperty({ example: TS })
  updatedAt!: string;
}

export class NotificationResponseDto {
  @ApiProperty({ example: UUID })
  id!: string;

  @ApiProperty({ example: 'mention' })
  type!: string;

  @ApiProperty({ example: UUID })
  projectId!: string;

  @ApiProperty({ nullable: true, example: UUID })
  itemId!: string | null;

  @ApiProperty({ example: { itemSequenceNum: 1, itemTitle: 'Login page is broken on mobile' } })
  data!: Record<string, unknown>;

  @ApiProperty({ nullable: true, example: null })
  readAt!: string | null;

  @ApiProperty({ example: TS })
  createdAt!: string;
}

export class ApiKeyResponseDto {  @ApiProperty({ example: UUID })
  id!: string;

  @ApiProperty({ example: 'CI script' })
  name!: string;

  @ApiProperty({ description: 'Public prefix for identification (full secret is shown once at creation).', example: 'clx_abc123' })
  keyPrefix!: string;

  @ApiProperty({ nullable: true, description: 'Project scope, if set.', example: null })
  projectId!: string | null;

  @ApiProperty({ nullable: true, example: null })
  expiresAt!: string | null;

  @ApiProperty({ nullable: true, example: null })
  lastUsedAt!: string | null;

  @ApiProperty({ example: 120 })
  rateLimitPerMin!: number;

  @ApiProperty({ example: TS })
  createdAt!: string;

  @ApiProperty({
    required: false,
    description: 'One-time secret — present ONLY in the create response. Store it immediately.',
    example: 'clx_abc123_def456',
  })
  secret?: string;
}

export class ItemTypeResponseDto {
  @ApiProperty({ example: UUID })
  id!: string;

  @ApiProperty({ example: 'Task' })
  name!: string;

  @ApiProperty({ example: '#3B82F6' })
  color!: string;

  @ApiProperty({ nullable: true, example: 'check-square' })
  icon!: string | null;

  @ApiProperty({ example: 1 })
  sortOrder!: number;
}

export class ItemStatusResponseDto {
  @ApiProperty({ example: UUID })
  id!: string;

  @ApiProperty({ example: 'To Do' })
  name!: string;

  @ApiProperty({ example: '#3B82F6' })
  color!: string;

  @ApiProperty({ enum: ['inbox', 'backlog', 'todo', 'active', 'done', 'cancelled'], example: 'todo' })
  category!: string;

  @ApiProperty({ example: true })
  isDefault!: boolean;

  @ApiProperty({ example: 2 })
  sortOrder!: number;
}

export class ItemPriorityResponseDto {
  @ApiProperty({ example: UUID })
  id!: string;

  @ApiProperty({ example: 'Medium' })
  name!: string;

  @ApiProperty({ nullable: true, example: '#F59E0B' })
  color!: string | null;

  @ApiProperty({ example: true })
  isDefault!: boolean;

  @ApiProperty({ example: 2 })
  sortOrder!: number;
}
