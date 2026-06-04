/**
 * Shared UI Components Library
 * 
 * Tập hợp các components UI tái sử dụng được trong toàn bộ ứng dụng.
 * Giúp đảm bảo tính nhất quán về design và giảm code duplication.
 */

export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { Card, CardHeader, CardTitle, CardContent, CardFooter } from './Card';
export type { CardProps, CardHeaderProps, CardTitleProps, CardContentProps, CardFooterProps } from './Card';

export { Input, Textarea } from './Input';
export type { InputProps, TextareaProps } from './Input';

export { Badge } from './Badge';
export type { BadgeProps, BadgeVariant, BadgeSize } from './Badge';

export { Modal, ModalHeader, ModalBody, ModalFooter } from './Modal';
export type { ModalProps, ModalHeaderProps, ModalBodyProps, ModalFooterProps } from './Modal';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { Skeleton, TableRowSkeleton, TableSkeleton, CardSkeleton, SidebarSkeleton } from './Skeleton';
export type { SkeletonProps } from './Skeleton';
