import React from 'react';
import { Loader2, LucideIcon } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'outline';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  uppercase?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm disabled:bg-indigo-400',
  secondary: 'bg-slate-600 text-white hover:bg-slate-700 shadow-sm disabled:bg-slate-400',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm disabled:bg-rose-400',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm disabled:bg-emerald-400',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 disabled:text-slate-400',
  outline: 'bg-transparent border-2 border-slate-300 text-slate-700 hover:bg-slate-50 disabled:border-slate-200 disabled:text-slate-400',
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'px-2 py-1 text-[9px] rounded-lg',
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-xl',
  lg: 'px-6 py-3 text-sm rounded-xl',
  xl: 'px-8 py-4 text-sm rounded-2xl',
};

const iconSizes: Record<ButtonSize, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon: Icon,
      iconPosition = 'left',
      fullWidth = false,
      uppercase = false,
      className = '',
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-normal transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500';
    const widthStyles = fullWidth ? 'w-full' : '';
    const textStyles = uppercase ? 'uppercase tracking-wide' : '';
    const disabledStyles = (disabled || loading) ? 'cursor-not-allowed opacity-60' : '';

    const iconSize = iconSizes[size];

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyles} ${textStyles} ${disabledStyles} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 size={iconSize} className="animate-spin" />}
        {!loading && Icon && iconPosition === 'left' && <Icon size={iconSize} />}
        {children}
        {!loading && Icon && iconPosition === 'right' && <Icon size={iconSize} />}
      </button>
    );
  }
);

Button.displayName = 'Button';
