import React from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  /** compact: dùng trong table cell / panel nhỏ. default: dùng full-page */
  size?: 'compact' | 'default';
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  size = 'default',
  className = '',
}) => {
  const isCompact = size === 'compact';

  return (
    <div
      className={[
        'flex flex-col items-center justify-center text-center',
        isCompact ? 'py-8 gap-2' : 'py-16 gap-4',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Icon circle */}
      <div
        className={[
          'flex items-center justify-center rounded-full bg-slate-100 text-slate-400',
          isCompact ? 'w-12 h-12' : 'w-16 h-16',
        ].join(' ')}
      >
        {icon ?? (
          <Inbox
            className={isCompact ? 'w-5 h-5' : 'w-7 h-7'}
            strokeWidth={1.5}
          />
        )}
      </div>

      {/* Text */}
      <div className="space-y-1">
        <p
          className={[
            'font-medium text-slate-600',
            isCompact ? 'text-xs' : 'text-sm',
          ].join(' ')}
        >
          {title}
        </p>
        {description && (
          <p
            className={[
              'text-slate-400 max-w-xs mx-auto leading-relaxed',
              isCompact ? 'text-2xs' : 'text-xs',
            ].join(' ')}
          >
            {description}
          </p>
        )}
      </div>

      {/* Action */}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-1 px-4 py-2 text-xs font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors duration-150"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
