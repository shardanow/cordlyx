import type { ProjectRole, StatusCategory, RelationType, ItemAction } from '../constants/index.js';

export type UUID = string;

export interface PaginationMeta {
  cursor: string | null;
  hasMore: boolean;
  limit: number;
}

export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: { field: string; message: string }[];
  requestId: string;
  timestamp: string;
}

// --- Entities ---

export interface User {
  id: UUID;
  email: string;
  name: string;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: UUID;
  name: string;
  slug: string;
  description: string | null;
  ownerId: UUID;
  isArchived: boolean;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: UUID;
  projectId: UUID;
  userId: UUID;
  role: ProjectRole;
  joinedAt: string;
  user?: Pick<User, 'id' | 'name' | 'avatarUrl'>;
}

export interface ItemType {
  id: UUID;
  projectId: UUID;
  name: string;
  color: string;
  icon: string | null;
  isDefault: boolean;
  sortOrder: number;
}

export interface ItemStatus {
  id: UUID;
  projectId: UUID;
  name: string;
  color: string;
  category: StatusCategory;
  isDefault: boolean;
  sortOrder: number;
}

export interface ItemPriority {
  id: UUID;
  projectId: UUID;
  name: string;
  color: string | null;
  icon: string | null;
  isDefault: boolean;
  sortOrder: number;
}

export interface RoadmapLane {
  id: UUID;
  roadmapId: UUID;
  name: string;
  color: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Roadmap {
  id: UUID;
  projectId: UUID;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  color: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Item {
  id: UUID;
  projectId: UUID;
  sequenceNum: number;
  typeId: UUID;
  statusId: UUID;
  priorityId: UUID;
  assigneeId: UUID | null;
  reporterId: UUID | null;
  parentId: UUID | null;
  planId: UUID | null;
  roadmapId: UUID | null;
  title: string;
  description: string | null;
  sortOrder: number;
  dueDate: string | null;
  startDate: string | null;
  estimatedHours: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  // populated
  type?: ItemType;
  status?: ItemStatus;
  priority?: ItemPriority;
  assignee?: Pick<User, 'id' | 'name' | 'avatarUrl'> | null;
  reporter?: Pick<User, 'id' | 'name' | 'avatarUrl'> | null;
  tags?: Tag[];
}

export interface Tag {
  id: UUID;
  projectId: UUID;
  name: string;
  color: string | null;
  createdAt: string;
}

export interface Comment {
  id: UUID;
  itemId: UUID;
  authorId: UUID;
  parentId: UUID | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  author?: Pick<User, 'id' | 'name' | 'avatarUrl'>;
  replies?: Comment[];
  reactions?: Record<string, { count: number; users: Pick<User, 'id' | 'name' | 'avatarUrl'>[] }>;
}

export interface CommentReaction {
  id: UUID;
  commentId: UUID;
  userId: UUID;
  reaction: string;
  createdAt: string;
}

export interface Attachment {
  id: UUID;
  itemId: UUID;
  commentId: UUID | null;
  uploaderId: UUID;
  filename: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  storageProvider: string;
  createdAt: string;
}

export interface ItemRelation {
  id: UUID;
  sourceItemId: UUID;
  targetItemId: UUID;
  relationType: RelationType;
  createdAt: string;
  targetItem?: Pick<Item, 'id' | 'sequenceNum' | 'title' | 'typeId' | 'statusId'>;
  sourceItem?: Pick<Item, 'id' | 'sequenceNum' | 'title' | 'typeId' | 'statusId'>;
}

export interface Activity {
  id: UUID;
  projectId: UUID;
  actorId: UUID;
  itemId: UUID | null;
  action: ItemAction;
  fieldName: string | null;
  oldValue: unknown;
  newValue: unknown;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor?: Pick<User, 'id' | 'name' | 'avatarUrl'>;
}
