import { z } from 'zod';
import {
  PROJECT_ROLES,
  STATUS_CATEGORIES,
  RELATION_TYPES,
  PLAN_TYPES,
  PLAN_STATUSES,
  PAGINATION_DEFAULTS,
  ROADMAP_SORT_OPTIONS,
} from '../constants/index.js';

// --- Auth ---

export const registerSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Only letters, numbers, _ and - allowed'),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  login: z.string().min(1),  // username or email
  password: z.string(),
});

export const refreshSchema = z.object({
  refreshToken: z.string(),
});

// --- User ---

export const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(128),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

// --- Project ---

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
  description: z.string().max(10000).nullable().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes')
    .optional(),
  description: z.string().max(10000).nullable().optional(),
  isArchived: z.boolean().optional(),
  settings: z.record(z.unknown()).optional(),
});

// --- Project Member ---

export const addMemberSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email().optional(),
  role: z.enum(PROJECT_ROLES),
});

export const updateMemberSchema = z.object({
  role: z.enum(PROJECT_ROLES),
});

// --- Item Config (types, statuses, priorities) ---

export const createItemTypeSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.string().max(50).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const createItemStatusSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  category: z.enum(STATUS_CATEGORIES),
  sortOrder: z.number().int().optional(),
});

export const createItemPrioritySchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

// --- Item ---

export const createItemSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(100000).optional().nullable(),
  typeId: z.string().uuid(),
  statusId: z.string().uuid().optional(),
  priorityId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  estimatedHours: z.number().min(0).max(999999).nullable().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  planId: z.string().uuid().nullable().optional(),
  roadmapId: z.string().uuid().nullable().optional(),
});

export const updateItemSchema = createItemSchema.partial();

export const quickCreateSchema = z.object({
  title: z.string().min(1).max(500),
  typeId: z.string().uuid(),
  projectSlug: z.string().optional(),
  statusId: z.string().uuid().optional(),
  planId: z.string().uuid().optional(),
  description: z.string().optional(),
});

// --- Board ---

export const moveItemSchema = z.object({
  statusId: z.string().uuid(),
  sortOrder: z.number().optional(),
});

// --- Tag ---

export const createTagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
});

// --- Comment ---

export const createCommentSchema = z.object({
  body: z.string().min(1).max(50000),
  parentId: z.string().uuid().nullable().optional(),
});

export const updateCommentSchema = z.object({
  body: z.string().min(1).max(50000),
});

export const addReactionSchema = z.object({
  reaction: z.string().min(1).max(20),
});

// --- Relation ---

export const createRelationSchema = z.object({
  targetItemId: z.string().uuid(),
  relationType: z.enum(RELATION_TYPES),
});

// --- Pagination / Search ---

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION_DEFAULTS.maxLimit)
    .default(PAGINATION_DEFAULTS.limit),
});

export const itemFilterSchema = paginationSchema.extend({
  typeId: z.string().uuid().optional(),
  statusId: z.string().uuid().optional(),
  priorityId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  reporterId: z.string().uuid().optional(),
  tagIds: z.string().optional(), // comma-separated
  parentId: z.string().uuid().optional(),
  planId: z.string().uuid().optional(),
  search: z.string().max(500).optional(),
  sort: z
    .enum(['created_at', '-created_at', 'updated_at', '-updated_at', 'priority', '-priority', 'due_date', '-due_date', 'status', '-status', 'assignee', '-assignee'])
    .default('-created_at'),
});

export const searchSchema = paginationSchema.extend({
  q: z.string().min(1).max(500),
  projectId: z.string().uuid().optional(),
});

// --- Activity ---

export const activityFilterSchema = paginationSchema.extend({
  actorId: z.string().uuid().optional(),
  action: z.string().optional(),
  itemId: z.string().uuid().optional(),
  sort: z.enum(['created_at', '-created_at']).optional().default('-created_at'),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

// --- Roadmap ---

export const createRoadmapSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  color: z.string().max(7).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export const updateRoadmapSchema = createRoadmapSchema.partial();

export const roadmapFilterSchema = z.object({
  sort: z.enum(ROADMAP_SORT_OPTIONS).default('-created_at'),
  search: z.string().max(500).optional(),
});

export const scheduleItemSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1),
  laneId: z.string().uuid().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

// --- Roadmap Lanes ---

export const createRoadmapLaneSchema = z.object({
  name: z.string().min(1).max(200),
  icon: z.string().max(10).optional().nullable(),
  color: z.string().max(7).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export const updateRoadmapLaneSchema = createRoadmapLaneSchema.partial();

// --- Plan ---

export const createPlanSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(PLAN_TYPES),
  description: z.string().max(5000).optional(),
  color: z.string().max(7).optional(),
  status: z.enum(PLAN_STATUSES).optional(),
  sortOrder: z.number().int().optional(),
});

export const updatePlanSchema = createPlanSchema.partial();
