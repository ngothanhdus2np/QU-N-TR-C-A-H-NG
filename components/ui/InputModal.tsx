import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface InputModalProps {
  isOpen: boolean;
  title: string;
  label: string;
  placeholder?: string;
  defaultValue?: string | number;
  type?: 'text' | 'number';
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

const InputModal: React.FC<InputModalProps> = ({
  isOpen,
  title,
  label,
  placeholder = '',
  defaultValue = '',
  type = 'text',
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Huỷ',
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState(String(defaultValue ?? ''));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(String(defaultValue ?? ''));
      // Auto-focus after animation
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() !== '') onConfirm(value);
  };

  return (
    <div className="fixed inset-0 z-toast flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Title */}
        <h3 className="font-bold text-slate-800 text-base mb-4">{title}</h3>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <label className="block text-xs font-normal text-slate-500 uppercase tracking-wider mb-1.5">
            {label}
          </label>
          <input
            ref={inputRef}
            type={type}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={placeholder}
            min={type === 'number' ? 0 : undefined}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />

          {/* Actions */}
          <div className="flex gap-2 mt-4 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-normal rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-normal rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InputModal;
