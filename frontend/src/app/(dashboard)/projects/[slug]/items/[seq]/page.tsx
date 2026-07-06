'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getAccessToken } from '@/lib/api-client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';
import RichEditor from '@/components/RichEditor';
import ImagePreviewModal from '@/components/ImagePreviewModal';
import ReactionBar from '@/components/ReactionBar';
import Spinner from '@/components/Spinner';
import {
  ChevronLeft, Trash2, X, Upload, Edit3, MoreHorizontal,
  CircleDot, Flag, User, UserPlus, Calendar, Clock,
  Pencil, Tags, Link2, Paperclip, MessageSquare,
} from 'lucide-react';
import { icons, Target, Copy, ChevronUp } from 'lucide-react';
import { Select, SelectTrigger, SelectContent, SelectOption } from '@/components/ui/select';

interface ItemType {
  id: string; name: string; color: string; icon: string | null;
}

interface ItemStatus {
  id: string; name: string; color: string; category: string;
}

interface ItemPriority {
  id: string; name: string; color: string | null; icon: string | null;
}

interface Tag {
  id: string; name: string; color: string | null;
}

interface ProjectMember {
  id: string; userId: string; role: string; name: string; email: string; avatarUrl: string | null; joinedAt: string;
}

interface ItemDetail {
  id: string;
  projectId: string;
  sequenceNum: number;
  typeId: string;
  statusId: string;
  priorityId: string;
  assigneeId: string | null;
  reporterId: string | null;
  parentId: string | null;
  title: string;
  description: string | null;
  sortOrder: number;
  dueDate: string | null;
  estimatedHours: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  planId: string | null;
  tags: Tag[];
}

interface Comment {
  id: string;
  authorId: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; avatarUrl: string | null } | null;
  replies?: Comment[];
  reactions?: Record<string, { count: number; users: { id: string; name: string; avatarUrl: string | null }[] }>;
}

interface Attachment {
  id: string;
  originalFilename: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  url: string;
  uploader: { id: string; name: string; avatarUrl: string | null } | null;
}

interface Relation {
  id: string;
  sourceItemId: string;
  targetItemId: string;
  relationType: string;
  relatedItem?: { id: string; sequenceNum: number; title: string } | null;
  targetItem?: { id: string; sequenceNum: number; title: string } | null;
  sourceItem?: { id: string; sequenceNum: number; title: string } | null;
}

interface ActivityEntry {
  id: string;
  action: string;
  fieldName: string | null;
  oldValue: unknown;
  newValue: unknown;
  metadata: unknown;
  createdAt: string;
  actor: { id: string; name: string; avatarUrl: string | null } | null;
}

const RELATION_LABELS: Record<string, string> = {
  blocks: 'Blocks',
  depends_on: 'Depends on',
  relates_to: 'Relates to',
  duplicates: 'Duplicates',
  child_of: 'Child of',
  next_action: 'Next Action',
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const API_ORIGIN = API_URL.replace('/api/v1', '');

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3 class="font-semibold text-base mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-semibold text-lg mt-4 mb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="font-bold text-xl mt-4 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 rounded text-xs font-mono">$1</code>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-4 border-muted pl-3 text-muted-foreground italic">$1</blockquote>')
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-primary underline" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\n\n/g, '</p><p class="mb-2 mt-1">')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p class="mb-2">')
    .replace(/$/, '</p>');
}

function kebabToPascal(str: string): string {
  return str.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

const ICON_ALIASES: Record<string, string> = {
  'check-square': 'SquareCheckBig',
};

function TypeIcon({ name, className }: { name: string | null; className?: string }) {
  if (!name) return null;
  const m = icons as unknown as Record<string, React.ComponentType<{ className?: string }> | undefined>;
  const key = ICON_ALIASES[name] ?? kebabToPascal(name);
  const LucideIcon = m[key];
  if (LucideIcon) return <LucideIcon className={className ?? 'w-4 h-4'} />;
  return <span className="w-4 h-4 flex items-center justify-center text-xs">{name}</span>;
}

function AvatarCircle({ name, className }: { name: string; className?: string }) {
  return (
    <div className={`w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0 overflow-hidden ${className ?? ''}`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function ItemDetailPage() {
  const { slug, seq } = useParams<{ slug: string; seq: string }>();
  const queryClient = useQueryClient();
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const fileRef = useRef<HTMLInputElement>(null);
  const [newComment, setNewComment] = useState('');
  const [commentHtml, setCommentHtml] = useState('');
  const [voted, setVoted] = useState(false);
  const [voteCount, setVoteCount] = useState(0);
  const [commentExpanded, setCommentExpanded] = useState(false);
  const [editCommentId, setEditCommentId] = useState<string | null>(null);
  const [editCommentHtml, setEditCommentHtml] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyToName, setReplyToName] = useState('');
  const [replyHtml, setReplyHtml] = useState('');
  const [uploading, setUploading] = useState(false);
  const [relationMenu, setRelationMenu] = useState(false);
  const [relationTarget, setRelationTarget] = useState('');
  const [relationType, setRelationType] = useState('relates_to');
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [descriptionPreview, setDescriptionPreview] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [tagCreateOpen, setTagCreateOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<Tag[]>([]);
  const [showAllMeta, setShowAllMeta] = useState(false);

  const { data: item, isLoading } = useQuery<ItemDetail>({
    queryKey: ['item', slug, seq],
    queryFn: () => api.get(`/projects/${slug}/items/${seq}`),
  });

  const { data: votesData } = useQuery<{ count: number; voters: string[] }>({
    queryKey: ['votes', item?.id],
    queryFn: () => api.get(`/projects/${slug}/items/${item!.id}/votes`),
    enabled: !!item?.id,
  });

  useEffect(() => {
    if (!votesData) return;
    setVoteCount(votesData.count);
    setVoted(votesData.voters.includes(currentUser?.id ?? ''));
  }, [votesData, currentUser]);

  const { data: project } = useQuery<{ id: string; name: string; slug: string }>({
    queryKey: ['project', slug],
    queryFn: () => api.get(`/projects/${slug}`),
  });

  const { data: types } = useQuery<ItemType[]>({
    queryKey: ['types', slug],
    queryFn: () => api.get(`/projects/${slug}/types`),
  });

  const { data: statuses } = useQuery<ItemStatus[]>({
    queryKey: ['statuses', slug],
    queryFn: () => api.get(`/projects/${slug}/statuses`),
  });

  const { data: priorities } = useQuery<ItemPriority[]>({
    queryKey: ['priorities', slug],
    queryFn: () => api.get(`/projects/${slug}/priorities`),
  });

  const { data: members } = useQuery<ProjectMember[]>({
    queryKey: ['members', slug],
    queryFn: () => api.get(`/projects/${slug}/members`),
  });

  const { data: projectTags } = useQuery<Tag[]>({
    queryKey: ['tags', slug],
    queryFn: () => api.get(`/projects/${slug}/tags`),
  });

  interface Plan { id: string; name: string; type: string; color: string | null; }
  const { data: plans } = useQuery<Plan[]>({
    queryKey: ['plans', slug],
    queryFn: () => api.get(`/projects/${slug}/plans`),
  });

  const { data: comments, isLoading: commentsLoading } = useQuery<Comment[]>({
    queryKey: ['comments', slug, item?.id],
    queryFn: () => api.get(`/projects/${slug}/items/${item!.id}/comments`),
    enabled: !!item?.id,
  });

  const allComments = useMemo(() => {
    if (!comments) return [];
    return comments.flatMap((c) => [c, ...(c.replies ?? [])]);
  }, [comments]);

  const { data: attachments, isLoading: attLoading } = useQuery<Attachment[]>({
    queryKey: ['attachments', slug, item?.id],
    queryFn: () => api.get(`/projects/${slug}/items/${item!.id}/attachments`),
    enabled: !!item?.id,
  });

  const { data: relationsResponse, isLoading: relsLoading } = useQuery<{ outgoing: Relation[]; incoming: Relation[] }>({
    queryKey: ['relations', slug, item?.id],
    queryFn: () => api.get(`/projects/${slug}/items/${item!.id}/relations`),
    enabled: !!item?.id,
  });

  const relations = useMemo(() => {
    const out = (relationsResponse?.outgoing ?? []).map((r) => ({ ...r, relatedItem: r.targetItem }));
    const inc = (relationsResponse?.incoming ?? []).map((r) => ({ ...r, relatedItem: r.sourceItem }));
    return [...out, ...inc];
  }, [relationsResponse]);

  const { data: itemActivity } = useQuery<{ data: ActivityEntry[] }>({
    queryKey: ['item-activity', slug, item?.id],
    queryFn: () => api.get(`/projects/${slug}/items/${item!.id}/activity?limit=20`),
    enabled: !!item?.id,
  });

  const { data: allItems } = useQuery<{ data: { id: string; sequenceNum: number; title: string }[] }>({
    queryKey: ['allItems', slug],
    queryFn: () => api.get(`/projects/${slug}/items?limit=200`),
    enabled: relationMenu,
  });

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newComment.trim() && !commentHtml.trim()) || !item) return;
    const body = commentHtml || newComment;
    try {
      await api.post(`/projects/${slug}/items/${item.id}/comments`, { body });
      setNewComment('');
      setCommentHtml('');
      setCommentExpanded(false);
      queryClient.invalidateQueries({ queryKey: ['comments', slug, item.id] });
      toast.success('Comment added');
    } catch {
      toast.error('Failed to add comment');
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editCommentHtml.trim() || !item) return;
    try {
      await api.patch(`/projects/${slug}/items/${item.id}/comments/${commentId}`, { body: editCommentHtml });
      setEditCommentId(null);
      setEditCommentHtml('');
      queryClient.invalidateQueries({ queryKey: ['comments', slug, item.id] });
      toast.success('Comment updated');
    } catch {
      toast.error('Failed to edit comment');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!item) return;
    try {
      await api.delete(`/projects/${slug}/items/${item.id}/comments/${commentId}`);
      queryClient.invalidateQueries({ queryKey: ['comments', slug, item.id] });
      toast.success('Comment deleted');
    } catch {
      toast.error('Failed to delete comment');
    }
  };

  const handleToggleReaction = async (commentId: string, emoji: string) => {
    if (!item || !currentUser) return;
    const comment = allComments?.find((c) => c.id === commentId);
    const isMine = comment?.reactions?.[emoji]?.users.some((u) => u.id === currentUser.id);
    try {
      if (isMine) {
        await api.delete(`/projects/${slug}/items/${item.id}/comments/${commentId}/reactions/${encodeURIComponent(emoji)}`);
      } else {
        await api.post(`/projects/${slug}/items/${item.id}/comments/${commentId}/reactions`, { reaction: emoji });
      }
      queryClient.invalidateQueries({ queryKey: ['comments', slug, item.id] });
    } catch {
      toast.error('Failed to update reaction');
    }
  };

  const handleReplySubmit = async (parentId: string, body: string) => {
    if (!body.trim() || !item) return;
    try {
      await api.post(`/projects/${slug}/items/${item.id}/comments`, { body, parentId });
      setReplyToId(null);
      setReplyHtml('');
      setReplyToName('');
      queryClient.invalidateQueries({ queryKey: ['comments', slug, item.id] });
      toast.success('Reply added');
    } catch {
      toast.error('Failed to add reply');
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      await api.delete(`/projects/${slug}/items/${item.id}`);
      queryClient.invalidateQueries({ queryKey: ['items', slug] });
      queryClient.invalidateQueries({ queryKey: ['board', slug] });
      toast.success('Item deleted');
      router.push(`/projects/${slug}`);
    } catch {
      toast.error('Failed to delete item');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !item) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = getAccessToken();
      await fetch(`${API_URL}/projects/${slug}/items/${item.id}/attachments`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      queryClient.invalidateQueries({ queryKey: ['attachments', slug, item.id] });
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleFieldUpdate = async (field: string, value: unknown) => {
    if (!item) return;
    try {
      await api.patch(`/projects/${slug}/items/${item.id}`, { [field]: value });
      queryClient.invalidateQueries({ queryKey: ['item', slug, seq] });
    } catch {
      toast.error(`Failed to update ${field}`);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!item) return;
    try {
      await api.delete(`/projects/${slug}/items/${item.id}/attachments/${attachmentId}`);
      queryClient.invalidateQueries({ queryKey: ['attachments', slug, item.id] });
      toast.success('Attachment deleted');
    } catch {
      toast.error('Failed to delete attachment');
    }
  };

  const handleAddRelation = async () => {
    if (!relationTarget || !item) return;
    try {
      await api.post(`/projects/${slug}/items/${item.id}/relations`, {
        targetItemId: relationTarget,
        relationType,
      });
      setRelationTarget('');
      setRelationMenu(false);
      queryClient.invalidateQueries({ queryKey: ['relations', slug, item.id] });
      toast.success('Relation added');
    } catch {
      toast.error('Failed to add relation');
    }
  };

  const handleDeleteRelation = async (relationId: string) => {
    if (!item) return;
    try {
      await api.delete(`/projects/${slug}/items/${item.id}/relations/${relationId}`);
      queryClient.invalidateQueries({ queryKey: ['relations', slug, item.id] });
      toast.success('Relation removed');
    } catch {
      toast.error('Failed to delete relation');
    }
  };

  const handleTagToggle = async (tag: Tag) => {
    if (!item) return;
    const currentIds = (item.tags ?? []).map((t) => t.id);
    const isOnItem = currentIds.includes(tag.id);
    const newIds = isOnItem ? currentIds.filter((id) => id !== tag.id) : [...currentIds, tag.id];
    try {
      await api.patch(`/projects/${slug}/items/${item.id}`, { tagIds: newIds });
      queryClient.invalidateQueries({ queryKey: ['item', slug, seq] });
    } catch {
      toast.error('Failed to update tags');
    }
  };

  const handleCreateTag = async () => {
    if (!item || !tagInput.trim()) return;
    const name = tagInput.trim();
    const existing = projectTags?.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      await handleTagToggle(existing);
      setTagInput('');
      setTagSuggestions([]);
      setTagCreateOpen(false);
      return;
    }
    try {
      const newTag = await api.post<Tag>(`/projects/${slug}/tags`, { name });
      const currentIds = (item.tags ?? []).map((t) => t.id);
      await api.patch(`/projects/${slug}/items/${item.id}`, { tagIds: [...currentIds, newTag.id] });
      queryClient.invalidateQueries({ queryKey: ['item', slug, seq] });
      queryClient.invalidateQueries({ queryKey: ['tags', slug] });
      setTagInput('');
      setTagSuggestions([]);
      setTagCreateOpen(false);
    } catch {
      toast.error('Failed to create tag');
    }
  };

  const filterTagSuggestions = useCallback((input: string) => {
    if (!input.trim()) return [];
    const lower = input.toLowerCase();
    const onItemIds = new Set((item?.tags ?? []).map((t) => t.id));
    return (projectTags ?? []).filter((t) =>
      t.name.toLowerCase().includes(lower) && !onItemIds.has(t.id)
    );
  }, [projectTags, item]);

  if (isLoading) return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
        <div className="h-4 w-48 rounded bg-muted animate-pulse" />
        <div className="ml-auto w-10 h-10 rounded-lg bg-muted animate-pulse" />
      </div>
      <div className="flex items-center gap-3">
        <div className="h-8 w-24 rounded-lg bg-muted animate-pulse" />
        <div className="h-10 w-2/3 rounded-lg bg-muted animate-pulse" />
      </div>
      <div className="h-16 rounded-lg bg-muted animate-pulse" />
      <div className="h-40 rounded-lg bg-muted animate-pulse" />
      <div className="h-16 rounded-lg bg-muted animate-pulse" />
      <div className="h-16 rounded-lg bg-muted animate-pulse" />
      <div className="h-48 rounded-lg bg-muted animate-pulse" />
    </div>
  );
  if (!item) return <div className="text-muted-foreground">Item not found</div>;

  const type = types?.find((t) => t.id === item.typeId);
  const status = statuses?.find((s) => s.id === item.statusId);
  const priority = priorities?.find((p) => p.id === item.priorityId);
  const assignee = members?.find((m) => m.userId === item.assigneeId);
  const reporter = members?.find((m) => m.userId === item.reporterId);
  const plan = plans?.find((p) => p.id === item.planId);

  const itemTags = projectTags?.filter((t) => item.tags?.some((it) => it.id === t.id)) ?? [];

  const cardClasses = 'bg-card border border-border rounded-[14px]';

  return (
    <div>
      {/* Breadcrumbs row */}
      <div className="flex items-center gap-3 md:gap-4 mb-4">
        <Link
          href={`/projects/${slug}`}
          className="w-9 h-9 rounded-full grid place-items-center bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          aria-label="Back to project"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm text-muted-foreground font-medium min-w-0">
          <Link href="/projects" className="hover:text-foreground transition-colors hidden sm:inline">Projects</Link>
          <span className="text-muted-foreground hidden sm:inline">/</span>
          <Link href={`/projects/${slug}`} className="hover:text-foreground transition-colors truncate hidden sm:inline">{project?.name ?? slug}</Link>
          <span className="text-muted-foreground hidden sm:inline">/</span>
          <span className="text-foreground truncate">{item.title}</span>
        </div>
        <button
          onClick={handleDelete}
          className="ml-auto w-9 h-9 grid place-items-center border border-destructive/20 rounded-lg text-destructive/70 hover:text-destructive hover:bg-destructive/5 transition-colors shrink-0"
          aria-label="Delete item"
        >
          <Trash2 className="w-[18px] h-[18px]" />
        </button>
      </div>

      {/* Title row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4 md:mb-5">
        {types && types.length > 0 && (
          <Select value={item.typeId} onChange={(v) => handleFieldUpdate('typeId', v)}>
            <SelectTrigger
              className="h-8 md:h-9 inline-flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3.5 rounded-lg text-xs md:text-sm font-bold whitespace-nowrap border border-border self-start"
              style={{
                borderColor: type?.color ? `${type.color}5c` : undefined,
                backgroundColor: type?.color ? `${type.color}18` : undefined,
                color: type?.color ?? undefined,
              }}
            >
              <TypeIcon name={type?.icon ?? null} className="w-3.5 md:w-4 h-3.5 md:h-4" />
              {type?.name ?? 'Select type'}
            </SelectTrigger>
            <SelectContent>
              {(types ?? []).map((t) => (
                <SelectOption key={t.id} value={t.id}>
                  <TypeIcon name={t.icon} className="w-4 h-4" />
                  {t.name}
                </SelectOption>
              ))}
            </SelectContent>
          </Select>
        )}
        <h1 className="text-2xl font-bold tracking-tight leading-none break-words">{item.title}</h1>
        <button
          onClick={async () => {
            try {
              const res = await api.post<{ voted: boolean }>(`/projects/${slug}/items/${item.id}/vote`);
              setVoteCount((c) => c + (res.voted ? 1 : -1));
              setVoted(res.voted);
            } catch { toast.error('Failed to vote'); }
          }}
          className={`shrink-0 h-8 px-3 rounded-lg border text-xs font-semibold transition-colors inline-flex items-center gap-1.5 ${
            voted ? 'bg-primary/10 text-primary border-primary/30' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          title="Vote for this item"
        >
          <ChevronUp className="w-3.5 h-3.5" />
          {voteCount}
        </button>
        <button
          onClick={async () => {
            try {
              const cloned = await api.post<{ sequenceNum: number }>(`/projects/${slug}/items/${item.id}/clone`);
              router.push(`/projects/${slug}/items/${cloned.sequenceNum}`);
            } catch { toast.error('Failed to clone item'); }
          }}
          className="shrink-0 h-8 px-3 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1.5"
          title="Clone item"
        >
          <Copy className="w-3.5 h-3.5" />
          Clone
        </button>
      </div>

      {/* Meta row */}
      <div className={`${cardClasses} mb-3`}>
        <div className="flex flex-wrap items-center gap-3 px-4 md:px-5 py-3 md:min-h-[60px]">
          {/* Status */}
          <div className="flex items-center gap-2 shrink-0">
            <CircleDot className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs md:text-sm font-semibold text-muted-foreground">Status</span>
            <Select value={item.statusId} onChange={(v) => handleFieldUpdate('statusId', v)}>
              <SelectTrigger>
                {status?.color && <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: status.color }} />}
                {status?.name ?? 'Select'}
              </SelectTrigger>
              <SelectContent>
                {(statuses ?? []).map((s) => (
                  <SelectOption key={s.id} value={s.id}>
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    {s.name}
                  </SelectOption>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-px h-5 bg-border shrink-0 hidden sm:block" />

          {/* Priority */}
          <div className="flex items-center gap-2 shrink-0">
            <Flag className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs md:text-sm font-semibold text-muted-foreground">Priority</span>
            <Select value={item.priorityId} onChange={(v) => handleFieldUpdate('priorityId', v)}>
              <SelectTrigger>
                {priority?.color && <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: priority.color }} />}
                {priority?.name ?? 'Select'}
              </SelectTrigger>
              <SelectContent>
                {(priorities ?? []).map((p) => (
                  <SelectOption key={p.id} value={p.id}>
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color ?? '#888' }} />
                    {p.name}
                  </SelectOption>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-px h-5 bg-border shrink-0 hidden sm:block" />

          {/* Assignee */}
          <div className="flex items-center gap-2 shrink-0">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs md:text-sm font-semibold text-muted-foreground">Assignee</span>
            <Select value={item.assigneeId ?? ''} onChange={(v) => handleFieldUpdate('assigneeId', v || null)}>
              <SelectTrigger>
                {assignee ? <AvatarCircle name={assignee.name} /> : <User className="w-3.5 h-3.5 text-muted-foreground" />}
                {assignee?.name ?? 'Unassigned'}
              </SelectTrigger>
              <SelectContent>
                <SelectOption value="">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  Unassigned
                </SelectOption>
                {(members ?? []).map((m) => (
                  <SelectOption key={m.userId} value={m.userId}>
                    <AvatarCircle name={m.name} />
                    {m.name}
                  </SelectOption>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-px h-5 bg-border shrink-0 hidden sm:block" />

          {/* Reporter */}
          <div className="flex items-center gap-2 shrink-0">
            <UserPlus className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs md:text-sm font-semibold text-muted-foreground">Reporter</span>
            {reporter ? (
              <span className="inline-flex items-center gap-1.5 text-sm">
                <AvatarCircle name={reporter.name} />
                {reporter.name}
              </span>
            ) : (
              <span className="text-sm text-foreground">Unknown</span>
            )}
          </div>

          <div className="w-px h-5 bg-border shrink-0 hidden sm:block" />

          {/* Plan */}
          <div className="flex items-center gap-2 shrink-0">
            <Target className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs md:text-sm font-semibold text-muted-foreground">Plan</span>
            <Select value={item.planId ?? ''} onChange={(v) => handleFieldUpdate('planId', v || null)}>
              <SelectTrigger>
                {plan ? <><div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: plan.color ?? '#6B7280' }} />{plan.name}</> : <span className="text-muted-foreground">No plan</span>}
              </SelectTrigger>
              <SelectContent>
                <SelectOption value=""><Target className="w-3.5 h-3.5 text-muted-foreground" />No plan</SelectOption>
                {(plans ?? []).map((p) => (
                  <SelectOption key={p.id} value={p.id}>
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color ?? '#6B7280' }} />
                    {p.name}
                  </SelectOption>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Hidden on mobile: Created, Updated, etc — shown via toggle */}
          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap sm:hidden">
            {showAllMeta && (
              <>
                <div className="w-px h-5 bg-border shrink-0" />
                <div className="flex items-center gap-2 shrink-0">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground">Created</span>
                  <span className="text-sm text-foreground">{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="w-px h-5 bg-border shrink-0" />
                <div className="flex items-center gap-2 shrink-0">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground">Updated</span>
                  <span className="text-sm text-foreground">{new Date(item.updatedAt).toLocaleDateString()}</span>
                </div>
                {item.dueDate && (
                  <>
                    <div className="w-px h-5 bg-border shrink-0" />
                    <div className="flex items-center gap-2 shrink-0">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground">Due</span>
                      <span className="text-sm text-foreground">{new Date(item.dueDate).toLocaleDateString()}</span>
                    </div>
                  </>
                )}
                {item.estimatedHours != null && (
                  <>
                    <div className="w-px h-5 bg-border shrink-0" />
                    <div className="flex items-center gap-2 shrink-0">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground">Estimated</span>
                      <span className="text-sm text-foreground">{item.estimatedHours}h</span>
                    </div>
                  </>
                )}
              </>
            )}
            <button
              onClick={() => setShowAllMeta(!showAllMeta)}
              className="h-7 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors sm:hidden"
            >
              <MoreHorizontal className="w-4 h-4" />
              <span className="sr-only">{showAllMeta ? 'Less' : 'More'}</span>
            </button>
          </div>

          {/* Desktop: always visible */}
          <div className="hidden sm:flex items-center gap-3 flex-nowrap overflow-x-auto">
            <div className="w-px h-5 bg-border shrink-0" />
            <div className="flex items-center gap-2 shrink-0">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-muted-foreground sr-only md:not-sr-only">Created</span>
              <span className="text-sm text-foreground whitespace-nowrap">{new Date(item.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="w-px h-5 bg-border shrink-0" />
            <div className="flex items-center gap-2 shrink-0">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-muted-foreground sr-only md:not-sr-only">Updated</span>
              <span className="text-sm text-foreground whitespace-nowrap">{new Date(item.updatedAt).toLocaleDateString()}</span>
            </div>
            {item.dueDate && (
              <>
                <div className="w-px h-5 bg-border shrink-0" />
                <div className="flex items-center gap-2 shrink-0">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-muted-foreground sr-only md:not-sr-only">Due</span>
                  <span className="text-sm text-foreground whitespace-nowrap">{new Date(item.dueDate).toLocaleDateString()}</span>
                </div>
              </>
            )}
            {item.estimatedHours != null && (
              <>
                <div className="w-px h-5 bg-border shrink-0" />
                <div className="flex items-center gap-2 shrink-0">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-muted-foreground sr-only md:not-sr-only">Estimated</span>
                  <span className="text-sm text-foreground whitespace-nowrap">{item.estimatedHours}h</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className={`${cardClasses} mb-3`}>
        <div className="px-4 md:px-5 py-3 md:py-4">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h2 className="text-base font-bold text-foreground">Description</h2>
            {!editingDescription && (
              <button
                onClick={() => { setDescriptionDraft(item.description ?? ''); setEditingDescription(true); setDescriptionPreview(false); }}
                className="w-8 h-8 grid place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title={item.description ? 'Edit description' : 'Add description'}
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>
          {editingDescription ? (
            <div className="space-y-2">
              <RichEditor
                content={descriptionDraft}
                onChange={setDescriptionDraft}
                placeholder="Add a description... Supports bold, italic, headings, lists, code blocks, links, and images."
                minHeight="150px"
                autoFocus
                attachments={(attachments ?? []).map((a) => ({ ...a, url: `${API_ORIGIN}${a.url}` }))}
                members={(members ?? []).map((m) => ({ id: m.userId, name: m.name, avatarUrl: m.avatarUrl }))}
                onImageUpload={async (file) => {
                  const formData = new FormData();
                  formData.append('file', file);
                  const token = getAccessToken();
                  const res = await fetch(`${API_URL}/projects/${slug}/items/${item!.id}/attachments`, {
                    method: 'POST',
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                    body: formData,
                  });
                  const att = await res.json();
                  queryClient.invalidateQueries({ queryKey: ['attachments', slug, item!.id] });
                  return `${API_ORIGIN}${att.url}`;
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={async () => { await handleFieldUpdate('description', descriptionDraft.trim() || null); setEditingDescription(false); }}
                  className="bg-primary text-primary-foreground px-4 py-1.5 rounded-md text-sm font-medium"
                >Save</button>
                <button onClick={() => setEditingDescription(false)} className="text-sm text-muted-foreground px-3 py-1.5 rounded-md hover:bg-muted">Cancel</button>
              </div>
            </div>
          ) : item.description ? (
            <div
              className="prose prose-sm max-w-none text-sm cursor-pointer hover:bg-muted/20 rounded-lg -mx-2 px-2 py-1 transition"
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.tagName === 'IMG') {
                  setPreviewImage((target as HTMLImageElement).src);
                  return;
                }
                setDescriptionDraft(item.description ?? ''); setEditingDescription(true); setDescriptionPreview(false);
              }}
              dangerouslySetInnerHTML={{
                __html: item.description.startsWith('<')
                  ? item.description
                  : renderMarkdown(item.description),
              }}
              title="Click to edit"
            />
          ) : (
            <button
              onClick={() => { setDescriptionDraft(''); setEditingDescription(true); setDescriptionPreview(false); }}
              className="w-full border border-border border-dashed rounded-lg p-4 text-sm text-muted-foreground hover:bg-muted/30 hover:border-muted-foreground/40 text-left transition flex items-center justify-center gap-2"
            >
              <Pencil className="w-4 h-4" />
              Click to add a description...
            </button>
          )}
        </div>
      </div>

      {/* Tags strip */}
      <div className={`${cardClasses} mb-3`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 md:px-5 py-2.5 md:py-3">
          <div className="flex items-center gap-2.5 shrink-0">
            <Tags className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-bold text-foreground">Tags</span>
          </div>
          <div className="flex items-center flex-wrap gap-2">
            {itemTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-muted/50 text-sm text-foreground"
                style={tag.color ? { borderColor: `${tag.color}3d`, color: tag.color } : undefined}
              >
                {tag.name}
                <button
                  onClick={() => handleTagToggle(tag)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
            {itemTags.length === 0 && !tagCreateOpen && (
              <span className="text-sm text-muted-foreground">No tags</span>
            )}
          </div>
          <div className="flex-1" />
          {tagCreateOpen ? (
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  value={tagInput}
                  onChange={(e) => { setTagInput(e.target.value); setTagSuggestions(filterTagSuggestions(e.target.value)); }}
                  placeholder="Search or create..."
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateTag(); } }}
                  autoFocus
                  className="h-8 w-40 rounded-lg border border-border bg-background px-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                {tagSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-32 overflow-y-auto">
                    {tagSuggestions.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => { handleTagToggle(t); setTagInput(''); setTagSuggestions([]); setTagCreateOpen(false); }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition flex items-center gap-2"
                      >
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color ?? '#3B82F6' }} />
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
                {tagInput.trim() && !projectTags?.some((t) => t.name.toLowerCase() === tagInput.trim().toLowerCase()) && (
                  <button
                    onClick={handleCreateTag}
                    className="w-full text-left px-3 py-1.5 text-xs text-primary hover:bg-muted transition border-t border-border"
                  >
                    + Create &quot;{tagInput.trim()}&quot;
                  </button>
                )}
              </div>
              <button
                onClick={() => { setTagCreateOpen(false); setTagInput(''); setTagSuggestions([]); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setTagCreateOpen(true)}
              className="text-sm text-primary hover:underline font-semibold shrink-0"
            >
              + Add tag
            </button>
          )}
        </div>
      </div>

      {/* Relations strip */}
      <div className={`${cardClasses} mb-3`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 md:px-5 py-2.5 md:py-3">
          <div className="flex items-center gap-2.5 shrink-0">
            <Link2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-bold text-foreground">Relations</span>
            {relsLoading && <Spinner size="sm" />}
          </div>
          <div className="flex items-center flex-wrap gap-2">
            {relations.map((rel) => {
              const related = rel.relatedItem;
              return (
                <span
                  key={rel.id}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-muted/50 text-sm text-foreground"
                >
                  <span className="text-muted-foreground text-xs">{RELATION_LABELS[rel.relationType] ?? rel.relationType}</span>
                  <Link
                    href={`/projects/${slug}/items/${related?.sequenceNum}`}
                    className="font-medium hover:underline"
                  >
                    #{related?.sequenceNum} {related?.title}
                  </Link>
                  <button
                    onClick={() => handleDeleteRelation(rel.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              );
            })}
            {relations.length === 0 && !relationMenu && (
              <span className="text-sm text-muted-foreground">No relations</span>
            )}
          </div>
          <div className="flex-1" />
          {relationMenu ? (
            <div className="flex items-center gap-2">
              <select
                value={relationType}
                onChange={(e) => setRelationType(e.target.value)}
                className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
              >
                {Object.entries(RELATION_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <select
                value={relationTarget}
                onChange={(e) => setRelationTarget(e.target.value)}
                className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
              >
                <option value="">Select item...</option>
                {(allItems?.data ?? []).filter((i) => i.id !== item.id).map((i) => (
                  <option key={i.id} value={i.id}>#{i.sequenceNum} {i.title}</option>
                ))}
              </select>
              <button
                onClick={handleAddRelation}
                disabled={!relationTarget}
                className="h-8 px-3 bg-primary text-primary-foreground rounded-lg text-xs font-medium disabled:opacity-50"
              >
                Add
              </button>
              <button
                onClick={() => { setRelationMenu(false); setRelationTarget(''); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setRelationMenu(true)}
              className="text-sm text-primary hover:underline font-semibold shrink-0"
            >
              + Add relation
            </button>
          )}
        </div>
      </div>

      {/* Attachments strip */}
      <div className={`${cardClasses} mb-3`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 md:px-5 py-2.5 md:py-3">
          <div className="flex items-center gap-2.5 shrink-0">
            <Paperclip className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-bold text-foreground">
              Attachments {attachments && attachments.length > 0 ? `(${attachments.length})` : ''}
            </span>
            {attLoading && <Spinner size="sm" />}
          </div>
          <div className="flex items-center flex-wrap gap-3">
            {(attachments ?? []).map((att) => {
              const fullUrl = `${API_ORIGIN}${att.url}`;
              const isImage = att.mimeType.startsWith('image/');
              return (
                <div key={att.id} className="flex items-center gap-2.5 min-w-[220px]">
                  {isImage ? (
                    <button onClick={() => setPreviewImage(fullUrl)} className="shrink-0">
                      <img src={fullUrl} alt={att.originalFilename} className="w-10 h-10 rounded-lg object-cover border border-border" />
                    </button>
                  ) : (
                    <span className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-lg shrink-0">📄</span>
                  )}
                  <div className="min-w-0">
                    <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold truncate block hover:underline leading-tight">
                      {att.originalFilename}
                    </a>
                    <span className="text-xs text-muted-foreground">{formatSize(att.sizeBytes)}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteAttachment(att.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
            {(!attachments || attachments.length === 0) && (
              <span className="text-sm text-muted-foreground">No attachments</span>
            )}
          </div>
          <div className="flex-1" />
          <label className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg border border-primary/20 text-primary bg-primary/5 hover:bg-primary/10 transition-colors text-sm font-semibold cursor-pointer shrink-0">
            <Upload className="w-3.5 h-3.5" />
            {uploading ? 'Uploading...' : 'Upload'}
            <input
              ref={fileRef}
              type="file"
              onChange={handleUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* Comments */}
      <div className={`${cardClasses}`}>
        <div className="px-4 md:px-5 py-3 md:py-4">
          <h2 className="text-sm md:text-base font-bold text-foreground mb-3 md:mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            Comments ({allComments?.length ?? 0})
            {commentsLoading && <Spinner size="sm" />}
          </h2>

          {/* Comment form */}
          <div className="border border-border rounded-lg bg-card mb-5">
            {commentExpanded ? (
              <div className="p-3">
                <form onSubmit={handleAddComment}>
                  <RichEditor
                    content={commentHtml}
                    onChange={(html) => { setCommentHtml(html); setNewComment(html); }}
                    placeholder="Write a comment... Use @username to mention someone"
                    minHeight="80px"
                    attachments={(attachments ?? []).map((a) => ({ ...a, url: `${API_ORIGIN}${a.url}` }))}
                    members={(members ?? []).map((m) => ({ id: m.userId, name: m.name, avatarUrl: m.avatarUrl }))}
                    onImageUpload={async (file) => {
                      const formData = new FormData();
                      formData.append('file', file);
                      const token = getAccessToken();
                      const res = await fetch(`${API_URL}/projects/${slug}/items/${item!.id}/attachments`, {
                        method: 'POST',
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                        body: formData,
                      });
                      const att = await res.json();
                      queryClient.invalidateQueries({ queryKey: ['attachments', slug, item!.id] });
                      return `${API_ORIGIN}${att.url}`;
                    }}
                  />
                  <div className="flex items-center gap-2 mt-2 justify-end">
                    <button
                      type="button"
                      onClick={() => { setCommentExpanded(false); setCommentHtml(''); setNewComment(''); }}
                      className="text-sm text-muted-foreground px-3 py-1.5 rounded-md hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!commentHtml.replace(/<[^>]*>/g, '').trim()}
                      className="h-9 px-4 bg-gradient-to-br from-[#7567ff] to-[#5147df] text-white rounded-lg text-sm font-bold disabled:opacity-50 shadow-[0_8px_20px_rgba(86,76,223,0.28)]"
                    >
                      Send
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCommentExpanded(true)}
                className="w-full text-left px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Write a comment...
              </button>
            )}
          </div>

          {/* Comment list */}
          <div className="space-y-1">
            {(comments ?? []).map((comment) => {
              const renderComment = (c: typeof comment, isReply = false) => {
                const isEditing = editCommentId === c.id;
                const isReplying = replyToId === c.id;
                return (
                <div key={c.id} className={`flex gap-3 px-0 py-3.5 border-t border-border/10 ${isReply ? 'ml-9 pl-4 border-l-2 border-border/20' : ''}`}>
                  <div className={`rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0 overflow-hidden ${isReply ? 'w-6 h-6 text-[9px]' : 'w-8 h-8'}`}>
                    {c.author?.avatarUrl ? (
                      <img src={c.author.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      c.author?.name?.charAt(0) ?? '?'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className="text-sm font-bold text-foreground">{c.author?.name ?? 'Unknown'}</span>
                      <span className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</span>
                    </div>

                    {/* Edit mode */}
                    {isEditing ? (
                      <div className="mt-1">
                        <RichEditor
                          content={editCommentHtml}
                          onChange={setEditCommentHtml}
                          placeholder="Edit your comment..."
                          minHeight="60px"
                          autoFocus
                          attachments={(attachments ?? []).map((a) => ({ ...a, url: `${API_ORIGIN}${a.url}` }))}
                          members={(members ?? []).map((m) => ({ id: m.userId, name: m.name, avatarUrl: m.avatarUrl }))}
                          onImageUpload={async (file) => {
                            const formData = new FormData();
                            formData.append('file', file);
                            const token = getAccessToken();
                            const res = await fetch(`${API_URL}/projects/${slug}/items/${item!.id}/attachments`, {
                              method: 'POST',
                              headers: token ? { Authorization: `Bearer ${token}` } : {},
                              body: formData,
                            });
                            const att = await res.json();
                            queryClient.invalidateQueries({ queryKey: ['attachments', slug, item!.id] });
                            return `${API_ORIGIN}${att.url}`;
                          }}
                        />
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => handleEditComment(c.id)} disabled={!editCommentHtml.replace(/<[^>]*>/g, '').trim()} className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md disabled:opacity-50">Save</button>
                          <button onClick={() => { setEditCommentId(null); setEditCommentHtml(''); }} className="text-xs text-muted-foreground px-3 py-1.5 rounded-md hover:bg-muted">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="prose prose-sm max-w-none text-sm text-foreground/90"
                        dangerouslySetInnerHTML={{
                          __html: c.body.startsWith('<') ? c.body : c.body.replace(/\n/g, '<br>'),
                        }}
                      />
                    )}

                    {/* Reactions */}
                    {currentUser && !isEditing && (
                      <div className="mt-2">
                        <ReactionBar
                          reactions={c.reactions ?? {}}
                          currentUserId={currentUser.id}
                          onToggle={(emoji) => handleToggleReaction(c.id, emoji)}
                          onAdd={(emoji) => handleToggleReaction(c.id, emoji)}
                        />
                      </div>
                    )}

                    {/* Reply button */}
                    {!isEditing && !isReply && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isReplying) {
                            setReplyToId(null);
                            setReplyHtml('');
                            setReplyToName('');
                          } else {
                            setReplyToId(c.id);
                            setReplyToName(c.author?.name ?? 'Unknown');
                            setReplyHtml('');
                          }
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground mt-1.5 transition-colors"
                      >
                        {isReplying ? 'Cancel' : 'Reply'}
                      </button>
                    )}

                    {/* Reply form */}
                    {isReplying && (
                      <div className="mt-2 border border-border rounded-lg bg-card p-2">
                        <div className="text-xs text-muted-foreground mb-1">Replying to <span className="font-semibold text-foreground">@{replyToName}</span></div>
                        <RichEditor
                          content={replyHtml}
                          onChange={setReplyHtml}
                          placeholder="Write a reply..."
                          minHeight="60px"
                          autoFocus
                          attachments={(attachments ?? []).map((a) => ({ ...a, url: `${API_ORIGIN}${a.url}` }))}
                          members={(members ?? []).map((m) => ({ id: m.userId, name: m.name, avatarUrl: m.avatarUrl }))}
                          onImageUpload={async (file) => {
                            const formData = new FormData();
                            formData.append('file', file);
                            const token = getAccessToken();
                            const res = await fetch(`${API_URL}/projects/${slug}/items/${item!.id}/attachments`, {
                              method: 'POST',
                              headers: token ? { Authorization: `Bearer ${token}` } : {},
                              body: formData,
                            });
                            const att = await res.json();
                            queryClient.invalidateQueries({ queryKey: ['attachments', slug, item!.id] });
                            return `${API_ORIGIN}${att.url}`;
                          }}
                        />
                        <div className="flex gap-2 mt-2 justify-end">
                          <button type="button" onClick={() => { setReplyToId(null); setReplyHtml(''); setReplyToName(''); }} className="text-xs text-muted-foreground px-2 py-1 rounded-md hover:bg-muted">Cancel</button>
                          <button
                            type="button"
                            onClick={() => handleReplySubmit(c.id, replyHtml)}
                            disabled={!replyHtml.replace(/<[^>]*>/g, '').trim()}
                            className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md disabled:opacity-50"
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Nested replies */}
                    {!isReply && (c.replies ?? []).map((reply) => renderComment(reply, true))}
                  </div>

                  {/* Edit/Delete buttons (own comments) */}
                  {currentUser?.id === c.authorId && (
                    <div className="flex items-start gap-1.5 shrink-0 pt-0.5">
                      <button onClick={() => { setEditCommentId(c.id); setEditCommentHtml(c.body); }} className="w-7 h-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Edit comment">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteComment(c.id)} className="w-7 h-7 grid place-items-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors" title="Delete comment">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
              };

              return renderComment(comment);
            })}
            {(!comments || comments.length === 0) && (
              <div className="text-sm text-muted-foreground text-center py-6">No comments yet.</div>
            )}
          </div>
        </div>
      </div>

      {previewImage && (
        <ImagePreviewModal src={previewImage} onClose={() => setPreviewImage(null)} />
      )}
    </div>
  );
}
