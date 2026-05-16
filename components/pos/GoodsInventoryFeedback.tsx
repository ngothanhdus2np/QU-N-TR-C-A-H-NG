import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import ConfirmDialog from '../ui/ConfirmDialog';
import InputModal from '../ui/InputModal';

type ToastState = { message: string; type: 'success' | 'error' } | null;
type InputModalState = {
  isOpen: boolean;
  title: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'number';
  defaultValue?: string | number;
  onConfirm: (val: string) => void;
};
type ConfirmDialogState = {
  isOpen: boolean;
  title: string;
  message: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  confirmLabel?: string;
  onConfirm: () => void;
};

interface GoodsInventoryFeedbackProps {
  toast: ToastState;
  inputModal: InputModalState;
  confirmDialog: ConfirmDialogState;
  onCloseInput: () => void;
  onCloseConfirm: () => void;
}

export const GoodsInventoryFeedback: React.FC<GoodsInventoryFeedbackProps> = ({
  toast,
  inputModal,
  confirmDialog,
  onCloseInput,
  onCloseConfirm
}) => (
  <>
    {toast && (
      <div className={`fixed bottom-6 right-6 z-[9998] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-normal transition-all animate-in slide-in-from-bottom-4 fade-in duration-300 ${
        toast.type === 'success'
          ? 'bg-emerald-600 text-white'
          : 'bg-rose-600 text-white'
      }`}>
        {toast.type === 'success'
          ? <CheckCircle2 className="h-4 w-4 shrink-0" />
          : <AlertCircle className="h-4 w-4 shrink-0" />}
        {toast.message}
      </div>
    )}

    <InputModal
      isOpen={inputModal.isOpen}
      title={inputModal.title}
      label={inputModal.label}
      placeholder={inputModal.placeholder}
      defaultValue={inputModal.defaultValue}
      type={inputModal.type}
      onConfirm={inputModal.onConfirm}
      onCancel={onCloseInput}
    />

    <ConfirmDialog
      isOpen={confirmDialog.isOpen}
      title={confirmDialog.title}
      message={confirmDialog.message}
      variant={confirmDialog.variant}
      confirmLabel={confirmDialog.confirmLabel}
      onConfirm={() => {
        confirmDialog.onConfirm();
        onCloseConfirm();
      }}
      onCancel={onCloseConfirm}
    />
  </>
);
