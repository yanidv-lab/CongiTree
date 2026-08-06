import React from 'react';
import { AlertTriangle, X, FolderPlus, Scissors, Trash2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'indigo' | 'emerald';
  iconType?: 'promote' | 'prune' | 'delete' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
  language?: 'he' | 'en';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'indigo',
  iconType = 'warning',
  onConfirm,
  onCancel,
  language = 'he',
}) => {
  if (!isOpen) return null;
  const isHe = language === 'he';

  const defaultConfirm = confirmLabel || (isHe ? 'אישור' : 'Confirm');
  const defaultCancel = cancelLabel || (isHe ? 'ביטול' : 'Cancel');

  const btnBg =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-100'
      : variant === 'emerald'
      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100';

  const renderIcon = () => {
    if (iconType === 'promote') return <FolderPlus className="w-5 h-5" />;
    if (iconType === 'prune') return <Scissors className="w-5 h-5" />;
    if (iconType === 'delete') return <Trash2 className="w-5 h-5" />;
    return <AlertTriangle className="w-5 h-5" />;
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        e.stopPropagation();
        onCancel();
      }}
    >
      <div 
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 text-slate-900 space-y-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              variant === 'danger' 
                ? 'bg-red-50 text-red-600 border border-red-100' 
                : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
            }`}>
              {renderIcon()}
            </div>
            <h3 className="text-base font-bold text-slate-900 leading-tight">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">{message}</p>

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors"
          >
            {defaultCancel}
          </button>
          <button
            onClick={() => {
              onConfirm();
            }}
            className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 ${btnBg}`}
          >
            {defaultConfirm}
          </button>
        </div>
      </div>
    </div>
  );
};
