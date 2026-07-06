export const PROJECT_ROLES = ['admin', 'member', 'viewer'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const STATUS_CATEGORIES = ['inbox', 'backlog', 'todo', 'active', 'done', 'cancelled'] as const;
export type StatusCategory = (typeof STATUS_CATEGORIES)[number];

export const RELATION_TYPES = ['blocks', 'depends_on', 'relates_to', 'duplicates', 'child_of', 'next_action'] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export const PLAN_TYPES = ['release', 'milestone', 'campaign', 'goal', 'custom'] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export const PLAN_STATUSES = ['active', 'completed', 'cancelled'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const ITEM_ACTIONS = [
  'item.created',
  'item.updated',
  'item.deleted',
  'item.status_changed',
  'item.assigned',
  'comment.created',
  'comment.updated',
  'comment.deleted',
  'comment.reaction_added',
  'comment.reaction_removed',
  'attachment.created',
  'attachment.deleted',
  'relation.created',
  'relation.deleted',
  'plan.created',
  'plan.updated',
  'plan.deleted',
  'plan.status_changed',
  'item.vote_added',
  'item.vote_removed',
  'roadmap.created',
  'roadmap.updated',
  'roadmap.deleted',
] as const;
export type ItemAction = (typeof ITEM_ACTIONS)[number];

export const PAGINATION_DEFAULTS = {
  limit: 50,
  maxLimit: 500,
} as const;

export const FILE_UPLOAD = {
  maxSizeBytes: 10 * 1024 * 1024,
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/json',
    'application/zip',
    'application/gzip',
  ],
} as const;

export const ROADMAP_SORT_OPTIONS = ['created_at', '-created_at', 'name', '-name', 'sort_order', '-sort_order'] as const;
export type RoadmapSortOption = (typeof ROADMAP_SORT_OPTIONS)[number];

export const AUTH = {
  accessExpiresIn: '15m',
  refreshExpiresIn: '7d',
  bcryptRounds: 12,
} as const;
