import * as React from 'react';
import { cn } from '@/lib/utils';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
    src?: string | null;
    name?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg';
}

const sizeClasses = {
    xs: 'w-5 h-5 text-[9px]',
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
};

function Avatar({ src, name, size = 'md', className, ...props }: AvatarProps) {
    const initials = name?.charAt(0)?.toUpperCase() ?? '?';
    return (
        <div
            className={cn(
                'rounded-full bg-muted flex items-center justify-center shrink-0 font-medium text-muted-foreground overflow-hidden',
                sizeClasses[size],
                className,
            )}
            {...props}
        >
            {src ? (
                <img src={src} alt={name ?? ''} className="w-full h-full object-cover" />
            ) : (
                <span>{initials}</span>
            )}
        </div>
    );
}

export { Avatar };
