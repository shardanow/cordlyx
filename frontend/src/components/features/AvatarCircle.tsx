import { Avatar } from '@/components/ui/avatar';

interface AvatarCircleProps {
  name: string;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * User avatar: photo when avatarUrl is set, initial letter otherwise.
 * Thin wrapper over ui/Avatar keeping the historic AvatarCircle API.
 */
export function AvatarCircle({ name, avatarUrl, size = 'sm', className }: AvatarCircleProps) {
  return <Avatar src={avatarUrl ?? null} name={name} size={size} className={className} />;
}
