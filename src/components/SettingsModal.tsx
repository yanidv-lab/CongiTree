import React, { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, ShieldCheck, Check, AlertCircle, Trash2, X, ExternalLink } from 'lucide-react';
import { getStoredApiKey, setStoredApiKey, clearStoredApiKey, validateApiKey } from '../lib/apiKeyStore';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onKeySaved }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadKey();
    }
  }, [isOpen]);

  const loadKey = async () => {
    const key = await getStoredApiKey();
    setApiKey(key);
    setStatusMessage(null);
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setStatusMessage({ type: 'error', text: 'אנא הזן מפתח API תקין' });
      return;
    }

    setIsValidating(true);
    setStatusMessage({ type: 'info', text: 'מאמת מפתח מול שרתי Google Gemini...' });

    const result = await validateApiKey(apiKey);
    setIsValidating(false);

    if (result.valid) {
      await setStoredApiKey(apiKey);
      setStatusMessage({ type: 'success', text: 'מפתח ה-API נאמת ונשמר בהצלחה במכשיר!' });
      if (onKeySaved) onKeySaved();
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      setStatusMessage({ type: 'error', text: `אימות המפתח נכשל: ${result.message}` });
    }
  };

  const handleClear = async () => {
    await clearStoredApiKey();
    setApiKey('');
    setStatusMessage({ type: 'info', text: 'מפתח ה-API נמחק בהצלחה מהמכשיר.' });
    if (onKeySaved) onKeySaved();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" dir="rtl">
      <div className="relative w-full max-w-lg overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">הגדרות מפתח Gemini API</h2>
              <p className="text-xs text-slate-400">אבטחה וחיבור ישיר למודל AI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Security Banner */}
          <div className="flex items-start gap-3 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs">
            <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
            <div>
              <strong className="font-semibold block mb-0.5 text-emerald-200">אבטחה מלאה ללא דליפות</strong>
              מפתח ה-API שלך נשמר בצורה מוצפנת ומקומית בלבד במכשיר האנדרואיד שלך (`SharedPreferences`). 
              כל הפניות נשלחות ישירות מהמכשיר לשרתי Google הרשמיים בלבד (`generativelanguage.googleapis.com`).
            </div>
          </div>

          {/* API Key Input */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">
              מפתח Gemini API (של Google AI Studio)
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-4 py-3 pl-11 bg-slate-950 border border-slate-700/80 rounded-xl text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div className={`flex items-center gap-2 p-3 rounded-xl text-xs ${
              statusMessage.type === 'success' ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300' :
              statusMessage.type === 'error' ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300' :
              'bg-blue-500/15 border border-blue-500/30 text-blue-300'
            }`}>
              {statusMessage.type === 'success' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
              {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Link to Get API Key */}
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>אין לך מפתח API עדיין?</span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1 hover:underline"
            >
              הפק מפתח בחינם ב-Google AI Studio
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-t border-slate-800">
          <button
            onClick={handleClear}
            disabled={!apiKey || isValidating}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            מחק מפתח
          </button>
          
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors"
            >
              ביטול
            </button>
            <button
              onClick={handleSave}
              disabled={isValidating || !apiKey.trim()}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-indigo-600/20 transition-all"
            >
              {isValidating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  מאמת...
                </>
              ) : (
                'אימות ושמירה'
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
